// Point this at your own deployed worker (see worker/README.md).
const WORKER_URL = "https://random-paper-worker.YOUR-SUBDOMAIN.workers.dev/";

const els = {
  sheet: document.getElementById("sheet"),
  title: document.getElementById("title"),
  tag: document.getElementById("tag"),
  body: document.getElementById("body"),
  readMore: document.getElementById("read-more"),
  shuffle: document.getElementById("shuffle"),
};

async function loadPaper() {
  els.shuffle.classList.add("spinning");
  els.tag.textContent = "loading";
  try {
    const res = await fetch(WORKER_URL);
    if (!res.ok) throw new Error(`Worker returned ${res.status}`);
    const paper = await res.json();
    renderPaper(paper);
  } catch (err) {
    renderError(err);
  } finally {
    els.shuffle.classList.remove("spinning");
  }
}

function renderPaper(paper) {
  els.title.textContent = paper.title || "Untitled paper";
  els.tag.textContent = "random pick";
  els.body.innerHTML = "";

  const paragraphs = (paper.text || "No summary available yet.").split(/\n\n+/);
  for (const para of paragraphs) {
    const p = document.createElement("p");
    p.textContent = para;
    els.body.appendChild(p);
  }

  if (paper.url) {
    els.readMore.href = paper.url;
    els.readMore.style.display = "inline";
  } else {
    els.readMore.style.display = "none";
  }

  els.sheet.scrollTop = 0;
}

function renderError(err) {
  els.tag.textContent = "error";
  els.title.textContent = "Couldn't load a paper";
  els.body.innerHTML = "";
  const p = document.createElement("p");
  p.className = "placeholder";
  p.textContent = "Something went wrong reaching the paper archive. Try again in a moment.";
  els.body.appendChild(p);
  els.readMore.style.display = "none";
  console.error(err);
}

els.shuffle.addEventListener("click", loadPaper);
document.addEventListener("DOMContentLoaded", loadPaper);
