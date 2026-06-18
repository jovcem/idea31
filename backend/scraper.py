import requests
from bs4 import BeautifulSoup, Tag
from dataclasses import dataclass, field
from urllib.parse import urlparse


@dataclass
class ScrapeResult:
    url: str
    title: str
    text: str
    links: list[str] = field(default_factory=list)
    error: str = ""


@dataclass
class Product:
    title: str
    price: str
    image_url: str
    product_url: str
    options: dict[str, list[str]] = field(default_factory=dict)


@dataclass
class ProductsResult:
    url: str
    collection_title: str = ""
    products: list[Product] = field(default_factory=list)
    error: str = ""


def scrape(url: str) -> ScrapeResult:
    try:
        response = requests.get(url, timeout=15, headers={"User-Agent": "Mozilla/5.0"})
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")

        title = soup.title.string.strip() if soup.title else "No title"
        text = soup.get_text(separator="\n", strip=True)
        links = [
            a["href"] for a in soup.find_all("a", href=True)
            if a["href"].startswith("http")
        ]

        return ScrapeResult(url=url, title=title, text=text[:5000], links=links)
    except Exception as e:
        return ScrapeResult(url=url, title="", text="", error=str(e))


def scrape_products(collection_url: str) -> ProductsResult:
    try:
        api_url = collection_url.rstrip("/") + "/products.json?limit=250"
        response = requests.get(api_url, timeout=15, headers={"User-Agent": "Mozilla/5.0"})
        response.raise_for_status()
        data = response.json()

        parsed = urlparse(collection_url)
        base = f"{parsed.scheme}://{parsed.netloc}"

        products = []
        for p in data.get("products", []):
            image_url = p["images"][0]["src"] if p.get("images") else ""
            prices = [float(v["price"]) for v in p.get("variants", []) if v.get("price")]
            if prices:
                lo, hi = min(prices), max(prices)
                price = f"${lo:.2f}" if lo == hi else f"${lo:.2f} – ${hi:.2f}"
            else:
                price = "N/A"
            options = {
                o["name"]: o["values"]
                for o in p.get("options", [])
                if not (len(o["values"]) == 1 and o["values"][0] == "Default Title")
            }

            products.append(Product(
                title=p["title"],
                price=price,
                image_url=image_url,
                product_url=f"{base}/products/{p['handle']}",
                options=options,
            ))

        collection_title = collection_url.rstrip("/").split("/")[-1].replace("-", " ").title()
        return ProductsResult(url=collection_url, collection_title=collection_title, products=products)
    except Exception as e:
        return ProductsResult(url=collection_url, error=str(e))


@dataclass
class CollectionCard:
    name: str
    url: str
    image_url: str


def scrape_sofa_collections(page_url: str) -> list[CollectionCard]:
    response = requests.get(page_url, timeout=15, headers={"User-Agent": "Mozilla/5.0"})
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    parsed = urlparse(page_url)
    base = f"{parsed.scheme}://{parsed.netloc}"

    cards = []
    for a in soup.find_all("a", href=True):
        text = a.get_text(strip=True)
        href = a["href"]
        if "View the collection" not in text or "/collections/" not in href:
            continue
        name = text.replace("View the collection", "").strip()
        url = href if href.startswith("http") else base + href
        image_url = ""
        parent = a.parent
        for _ in range(6):
            if not isinstance(parent, Tag):
                break
            img = parent.find("img")
            if img:
                src = img.get("src") or img.get("data-src") or ""
                image_url = ("https:" + src) if src.startswith("//") else src
                break
            parent = parent.parent
        cards.append(CollectionCard(name=name, url=url, image_url=image_url))
    return cards
