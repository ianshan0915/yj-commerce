const header = document.querySelector("[data-header]");
const menuButton = document.querySelector("[data-menu-button]");
const nav = document.querySelector("[data-nav]");
const contactForm = document.querySelector("[data-contact-form]");
const formNote = document.querySelector("[data-form-note]");

const syncHeader = () => {
  header.classList.toggle("is-scrolled", window.scrollY > 16);
};

syncHeader();
window.addEventListener("scroll", syncHeader, { passive: true });

menuButton.addEventListener("click", () => {
  const isOpen = menuButton.getAttribute("aria-expanded") === "true";
  menuButton.setAttribute("aria-expanded", String(!isOpen));
  nav.classList.toggle("is-open", !isOpen);
  header.classList.toggle("is-open", !isOpen);
});

nav.addEventListener("click", (event) => {
  if (event.target instanceof HTMLAnchorElement) {
    menuButton.setAttribute("aria-expanded", "false");
    nav.classList.remove("is-open");
    header.classList.remove("is-open");
  }
});

if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches && "IntersectionObserver" in window) {
  const targets = document.querySelectorAll(".section-head, .svc, .step, .diagram-card, .connect-grid > div, .company-grid > div, .contact-grid > div");
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { rootMargin: "0px 0px -8% 0px" }
  );
  targets.forEach((el) => {
    el.classList.add("reveal");
    observer.observe(el);
  });
}

contactForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const isChinese = document.documentElement.lang.startsWith("zh");
  const formData = new FormData(contactForm);
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const message = String(formData.get("message") || "").trim();
  const subject = encodeURIComponent(isChinese ? "YJ Commerce 咨询" : "YJ Commerce inquiry");
  const nameLabel = isChinese ? "姓名" : "Name";
  const emailLabel = isChinese ? "邮箱" : "Email";
  const body = encodeURIComponent(`${nameLabel}: ${name}\n${emailLabel}: ${email}\n\n${message}`);

  window.location.href = `mailto:hello@yjcommerce.nl?subject=${subject}&body=${body}`;
  formNote.textContent = isChinese
    ? "正在打开您的邮件应用，内容已准备好。"
    : "Opening your email app with the message prepared.";
});
