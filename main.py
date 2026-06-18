import csv
import io
import os
import subprocess
import sys
import webbrowser
from pathlib import Path
from dotenv import load_dotenv
from nicegui import ui, run
from scraper import scrape, scrape_products, scrape_sofa_collections, ScrapeResult, ProductsResult, CollectionCard

_base = getattr(sys, '_MEIPASS', os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(_base, ".env"))


def _all_options(result: ProductsResult) -> list[str]:
    seen: set[str] = set()
    names: list[str] = []
    for p in result.products:
        for name in p.options:
            if name not in seen:
                names.append(name)
                seen.add(name)
    return names


def make_csv(result: ProductsResult) -> bytes:
    all_options = _all_options(result)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["product name"] + all_options)
    for p in result.products:
        writer.writerow([p.title] + [len(p.options.get(name, [])) for name in all_options])
    return buf.getvalue().encode()


def make_details_csv(result: ProductsResult) -> bytes:
    all_options = _all_options(result)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["product name"] + all_options)
    for p in result.products:
        cols = [p.options.get(name, []) for name in all_options]
        for i in range(max((len(c) for c in cols), default=1)):
            writer.writerow([p.title] + [c[i] if i < len(c) else "" for c in cols])
    return buf.getvalue().encode()


def render_home(collections: list[CollectionCard], container: ui.column, on_select) -> None:
    container.clear()
    with container:
        ui.label("Sofas at SOBU").classes("text-xl font-bold text-zinc-900")
        ui.label("Select a collection to browse").classes("text-sm text-zinc-400 mb-2")
        with ui.grid(columns=3).classes("w-full gap-4"):
            for c in collections:
                def make_handler(url):
                    async def handler():
                        await on_select(url)
                    return handler

                with ui.card().classes(
                    "w-full p-0 overflow-hidden border border-zinc-200 shadow-none rounded-xl "
                    "cursor-pointer hover:shadow-md hover:border-zinc-300 transition-all duration-200"
                ).on("click", make_handler(c.url)):
                    if c.image_url:
                        ui.image(c.image_url).classes("w-full object-cover").style("height: 200px")
                    with ui.element('div').classes("p-4"):
                        ui.label(c.name).classes("font-semibold text-sm text-zinc-900")
                        ui.label("View collection →").classes("text-xs text-zinc-400 mt-0.5")


def render_products(result: ProductsResult, container: ui.column, csv_btn: ui.button, details_btn: ui.button) -> None:
    container.clear()
    with container:
        if result.error:
            with ui.element('div').classes("rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600"):
                ui.label(f"Error: {result.error}")
            return

        with ui.grid(columns=3).classes("w-full gap-4"):
            for product in result.products:
                with ui.card().classes("w-full p-0 overflow-hidden border border-zinc-200 shadow-none rounded-xl hover:shadow-md transition-all duration-200"):
                    if product.image_url:
                        ui.image(product.image_url).classes("w-full object-cover").style("height: 200px")
                    with ui.column().classes("p-4 gap-1"):
                        ui.label(product.title).classes("font-semibold text-sm text-zinc-900 leading-snug")
                        ui.label(product.price).classes("text-sm font-medium text-zinc-500 mt-0.5")
                        for name, values in product.options.items():
                            ui.label(name.upper()).classes("text-[10px] font-semibold text-zinc-400 tracking-widest mt-2")
                            for v in values:
                                ui.label(v).classes("text-xs text-zinc-600 leading-snug")
                        ui.button(
                            "View product →",
                            on_click=lambda url=product.product_url: webbrowser.open(url),
                        ).props("flat no-caps dense").classes("text-xs text-zinc-400 hover:text-zinc-900 self-start mt-2 px-0")

    csv_btn.set_enabled(True)
    details_btn.set_enabled(True)


def render_result(result: ScrapeResult, container: ui.column) -> None:
    container.clear()
    with container:
        if result.error:
            with ui.element('div').classes("rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600"):
                ui.label(f"Error: {result.error}")
            return

        with ui.card().classes("w-full border border-zinc-200 shadow-none rounded-xl p-4"):
            ui.label(result.title).classes("text-lg font-semibold text-zinc-900")
            ui.label(result.url).classes("text-xs text-zinc-400 mt-0.5")

        with ui.tabs().classes("w-full") as tabs:
            tab_text = ui.tab("Text")
            tab_links = ui.tab(f"Links ({len(result.links)})")

        with ui.tab_panels(tabs, value=tab_text).classes("w-full"):
            with ui.tab_panel(tab_text):
                ui.textarea(value=result.text).classes("w-full").props("readonly rows=20 outlined")
            with ui.tab_panel(tab_links):
                for link in result.links:
                    ui.label(link).classes("text-blue-500 text-sm")


@ui.page("/")
def index():
    ui.add_head_html("""<style>
    :root { --q-primary: #18181b; }
    body { background: #f4f4f5 !important; margin: 0; }
    .nicegui-content { padding: 0 !important; }
    .q-field--outlined .q-field__control { border-radius: 8px; background: white; }
    .q-field--outlined .q-field__control:hover:before { border-color: #a1a1aa; }
    .q-field--outlined.q-field--focused .q-field__control:after { border-color: #18181b; border-width: 1px; }
    .q-btn { border-radius: 8px !important; letter-spacing: 0 !important; text-transform: none !important; }
    </style>""")

    current_result: list[ProductsResult] = []
    home_collections: list[CollectionCard] = []

    async def on_scrape(url_override: str = ""):
        try:
            if url_override:
                url_input.set_value(url_override)
            url = url_override or url_input.value.strip()
            if not url:
                ui.notify("Enter a URL first", type="warning")
                return
            if not url.startswith("http"):
                url = "https://" + url
                url_input.set_value(url)

            scrape_btn.disable()
            csv_btn.disable()
            details_btn.disable()
            status.set_text("Scraping…")
            current_result.clear()
            results_container.clear()

            if "/collections/" in url:
                result = await run.io_bound(scrape_products, url)
                current_result.append(result)
                render_products(result, results_container, csv_btn, details_btn)
                status.set_text(f"{len(result.products)} products" if not result.error else "")
                back_btn.set_visibility(True)
            else:
                result = await run.io_bound(scrape, url)
                render_result(result, results_container)
                status.set_text(f"{len(result.links)} links" if not result.error else "")
        except Exception as e:
            ui.notify(f"Error: {e}", type="negative")
            status.set_text("")
        finally:
            scrape_btn.enable()

    def download_file(content: bytes, filename: str):
        if os.getenv("WEB_PORT"):
            ui.download(content, filename)
        else:
            path = Path.home() / "Downloads" / filename
            path.write_bytes(content)
            subprocess.run(["open", str(path)])
            ui.notify(f"Saved to ~/Downloads/{filename}")

    def on_download():
        if current_result:
            name = current_result[0].collection_title.replace(" ", "_").lower()
            download_file(make_csv(current_result[0]), f"{name}_products.csv")

    def on_download_details():
        if current_result:
            name = current_result[0].collection_title.replace(" ", "_").lower()
            download_file(make_details_csv(current_result[0]), f"{name}_products_details.csv")

    with ui.element('div').classes("sticky top-0 z-50 w-full bg-white border-b border-zinc-200 shadow-sm"):
        with ui.row().classes("w-full px-6 py-3 gap-2 items-center"):
            ui.label("Scraper").classes("text-sm font-bold text-zinc-900 shrink-0 mr-2")
            url_input = ui.input(
                value=os.getenv("DEFAULT_URL", ""),
                placeholder="https://example.com/collections/...",
            ).props("outlined dense").classes("flex-1")
            back_btn = ui.button("←").props("flat no-caps").classes("text-zinc-500 text-sm shrink-0")
            back_btn.set_visibility(False)
            scrape_btn = ui.button("Scrape", on_click=on_scrape).props("unelevated no-caps").classes(
                "bg-zinc-900 text-white text-sm font-medium shrink-0"
            )
            csv_btn = ui.button("CSV", on_click=on_download, icon="download").props("outline no-caps").classes(
                "text-zinc-600 text-sm shrink-0"
            )
            csv_btn.disable()
            details_btn = ui.button("Details CSV", on_click=on_download_details, icon="download").props("outline no-caps").classes(
                "text-zinc-600 text-sm shrink-0"
            )
            details_btn.disable()
            status = ui.label("").classes("text-xs text-zinc-400 ml-1 shrink-0")

    results_container = ui.column().classes("w-full px-6 py-6 gap-4")

    async def on_collection_click(url: str):
        await on_scrape(url)

    def go_home():
        back_btn.set_visibility(False)
        csv_btn.disable()
        details_btn.disable()
        current_result.clear()
        url_input.set_value(os.getenv("DEFAULT_URL", ""))
        render_home(home_collections, results_container, on_collection_click)

    back_btn.on("click", lambda: go_home())

    async def load_home():
        status.set_text("Loading…")
        collections = await run.io_bound(scrape_sofa_collections, "https://sobusobu.com/pages/sofas-at-sobu")
        home_collections.extend(collections)
        render_home(collections, results_container, on_collection_click)
        status.set_text("")

    ui.timer(0, load_home, once=True)


web_port = os.getenv("WEB_PORT")
if web_port:
    ui.run(title="Scraper", host="0.0.0.0", port=int(web_port), reload=False)
else:
    ui.run(title="Scraper", native=True, window_size=(960, 700), reload=True)
