import io
import csv
import os
import re
import sys


from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv
import requests as http_requests

from scraper import scrape, scrape_products, scrape_sofa_collections, ProductsResult

_base = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(_base, ".env"))

STATIC_DIR = Path(_base) / "static"


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(lifespan=lifespan)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_BASE_URL = "https://api.groq.com/openai/v1"
CMS_URL = os.getenv("CMS_URL", "https://cms.cylin.dev").rstrip("/")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/home")
def home(url: str = "https://sobusobu.com/pages/sofas-at-sobu"):
    try:
        collections = scrape_sofa_collections(url)
        return [{"name": c.name, "url": c.url, "image_url": c.image_url} for c in collections]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/scrape")
def scrape_url(url: str = Query(...)):
    result = scrape(url)
    return {
        "url": result.url,
        "title": result.title,
        "text": result.text,
        "links": result.links,
        "error": result.error,
    }


@app.get("/api/collections")
def collections(url: str = Query(...)):
    result = scrape_products(url)
    return {
        "url": result.url,
        "collection_title": result.collection_title,
        "error": result.error,
        "products": [
            {
                "title": p.title,
                "price": p.price,
                "image_url": p.image_url,
                "product_url": p.product_url,
                "options": p.options,
            }
            for p in result.products
        ],
    }


def _material_code(name: str) -> str:
    return re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')


def _all_options(result: ProductsResult) -> list[str]:
    seen: set[str] = set()
    names: list[str] = []
    for p in result.products:
        for name in p.options:
            if name not in seen:
                names.append(name)
                seen.add(name)
    return names


def _make_csv(result: ProductsResult) -> bytes:
    all_options = _all_options(result)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["product name"] + all_options)
    for p in result.products:
        writer.writerow([p.title] + [len(p.options.get(name, [])) for name in all_options])
    return buf.getvalue().encode()


def _make_details_csv(result: ProductsResult) -> bytes:
    all_options = _all_options(result)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["product name"] + all_options)
    for p in result.products:
        cols = [p.options.get(name, []) for name in all_options]
        for i in range(max((len(c) for c in cols), default=1)):
            writer.writerow([p.title] + [c[i] if i < len(c) else "" for c in cols])
    return buf.getvalue().encode()


@app.get("/api/collections/csv")
def collections_csv(url: str = Query(...)):
    result = scrape_products(url)
    if result.error:
        raise HTTPException(status_code=400, detail=result.error)
    name = result.collection_title.replace(" ", "_").lower()
    return StreamingResponse(
        io.BytesIO(_make_csv(result)),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{name}_products.csv"'},
    )


@app.get("/api/collections/details-csv")
def collections_details_csv(url: str = Query(...)):
    result = scrape_products(url)
    if result.error:
        raise HTTPException(status_code=400, detail=result.error)
    name = result.collection_title.replace(" ", "_").lower()
    return StreamingResponse(
        io.BytesIO(_make_details_csv(result)),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{name}_products_details.csv"'},
    )


class CmsAuthRequest(BaseModel):
    email: str
    password: str

class CmsImportRequest(BaseModel):
    project_id: str
    session_token: str
    products: list[dict]

class CmsMaterialsRequest(BaseModel):
    project_id: str
    customer_id: int
    session_token: str
    family_name: str
    materials: list[str]

_CREATE_PRODUCT_MUTATION = """
mutation ImportModalCreateProductData($productData: [ProductDataCreate!]!) {
  createProductData(productData: $productData) {
    id
  }
}
"""

def _map_product_to_cms(p: dict, project_id: str) -> dict:
    obj: dict = {"name": p.get("title", ""), "projectId": project_id}
    if p.get("productCode"):
        obj["productCode"] = p["productCode"]
    if p.get("product_url") and not str(p["product_url"]).startswith("csv:"):
        obj["url"] = p["product_url"]
    if p.get("productFamily"):
        obj["productFamilyName"] = p["productFamily"]
    if p.get("productType"):
        obj["productType"] = p["productType"]
    if p.get("productVersionType"):
        obj["productVersionType"] = p["productVersionType"]
    if p.get("isArchtype") is not None and p["isArchtype"] != "":
        val = p["isArchtype"]
        obj["isArcheType"] = val.lower() in ("true", "1", "yes") if isinstance(val, str) else bool(val)
    # productClass and dimensions (width/depth/height/unit) cannot be set on create:
    # the CMS schema requires an existing dimension ID (ProductDimensionUpdate.id is NON_NULL)
    # and productClassId expects an opaque ID, not a name string.
    return obj


@app.post("/api/cms/auth")
def cms_auth(req: CmsAuthRequest):
    try:
        base = CMS_URL
        session = http_requests.Session()

        csrf_resp = session.get(f"{base}/api/auth/csrf", timeout=10)
        if not csrf_resp.ok:
            raise HTTPException(status_code=400, detail="Failed to reach CMS — check the URL")
        csrf_token = csrf_resp.json()["csrfToken"]

        login_resp = session.post(
            f"{base}/api/auth/callback/credentials",
            data={
                "csrfToken": csrf_token,
                "email": req.email,
                "password": req.password,
                "redirect": "false",
                "callbackUrl": "/",
                "json": "true",
            },
            allow_redirects=False,
            timeout=15,
        )

        session_token = session.cookies.get("next-auth.session-token")
        if not session_token:
            for cookie in login_resp.cookies:
                if cookie.name == "next-auth.session-token":
                    session_token = cookie.value
                    break

        if not session_token:
            raise HTTPException(status_code=401, detail="Authentication failed — check credentials")

        return {"session_token": session_token}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/cms/import")
def cms_import(req: CmsImportRequest):
    try:
        base = CMS_URL
        product_data = [_map_product_to_cms(p, req.project_id) for p in req.products]

        resp = http_requests.post(
            f"{base}/api/graphql",
            headers={
                "Content-Type": "application/json",
                "Cookie": f"next-auth.session-token={req.session_token}",
            },
            json={"query": _CREATE_PRODUCT_MUTATION, "variables": {"productData": product_data}},
            timeout=60,
        )

        if not resp.ok:
            raise HTTPException(status_code=500, detail=f"CMS API error: {resp.text[:300]}")

        data = resp.json()
        gql_errors = data.get("errors") or []
        created = (data.get("data") or {}).get("createProductData") or []

        return {
            "created": created,
            "errors": [e.get("message", str(e)) for e in gql_errors],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


_CREATE_MATERIAL_FAMILY_MUTATION = """
mutation ProjectItemCreateMaterialFamily($families: [MaterialFamilyCreate!]!) {
  createMaterialFamilies(families: $families) {
    id
    name
  }
}
"""

_CREATE_MATERIAL_MUTATION = """
mutation ProjectCustomerMaterialsCreate($customerId: Int!, $projectId: ID, $customerMaterials: [CustomerMaterialCreate!]!) {
  createCustomerMaterials(
    customerId: $customerId
    projectId: $projectId
    customerMaterials: $customerMaterials
  ) {
    id
    name
    code
  }
}
"""

def _gql(session_token: str, query: str, variables: dict) -> dict:
    resp = http_requests.post(
        f"{CMS_URL}/api/graphql",
        headers={"Content-Type": "application/json", "Cookie": f"next-auth.session-token={session_token}"},
        json={"query": query, "variables": variables},
        timeout=60,
    )
    if not resp.ok:
        raise HTTPException(status_code=500, detail=f"CMS API error: {resp.text[:300]}")
    return resp.json()

@app.post("/api/cms/materials")
def cms_materials(req: CmsMaterialsRequest):
    try:
        # Step 1: create the material family
        family_resp = _gql(req.session_token, _CREATE_MATERIAL_FAMILY_MUTATION, {
            "families": [{"customerId": req.customer_id, "name": req.family_name}]
        })
        family_errors = family_resp.get("errors") or []
        families = (family_resp.get("data") or {}).get("createMaterialFamilies") or []
        if not families:
            msg = family_errors[0].get("message", "Unknown error") if family_errors else "No family returned"
            raise HTTPException(status_code=500, detail=f"Failed to create material family: {msg}")
        family_id = families[0]["id"]

        # Step 2: create materials linked to the family
        customer_materials = [
            {
                "name": m,
                "code": _material_code(m),
                "materialFamilyId": family_id,
                "materialVariation": {"name": m, "type": "Fabric", "swatchType": "Physical"},
            }
            for m in req.materials
        ]
        mat_resp = _gql(req.session_token, _CREATE_MATERIAL_MUTATION, {
            "customerId": req.customer_id,
            "projectId": req.project_id,
            "customerMaterials": customer_materials,
        })
        print("createCustomerMaterials response:", mat_resp, flush=True)
        gql_errors = mat_resp.get("errors") or []
        created_list = (mat_resp.get("data") or {}).get("createCustomerMaterials") or []
        return {
            "created": len(created_list),
            "errors": [e.get("message", str(e)) for e in gql_errors],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str

class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    model: str = "llama-3.1-8b-instant"
    json_mode: bool = False


@app.post("/api/chat")
def chat(req: ChatRequest):
    try:
        payload: dict = {
            "model": req.model,
            "messages": [{"role": m.role, "content": m.content} for m in req.messages],
        }
        if req.json_mode:
            payload["response_format"] = {"type": "json_object"}
        resp = http_requests.post(
            f"{GROQ_BASE_URL}/chat/completions",
            headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
            json=payload,
            timeout=120,
        )
        if not resp.ok:
            try:
                detail = resp.json().get("error", {}).get("message", resp.text)
            except Exception:
                detail = resp.text
            raise HTTPException(status_code=500, detail=detail)
        data = resp.json()
        return {
            "content": data["choices"][0]["message"]["content"],
            "usage": data.get("usage", {}),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
