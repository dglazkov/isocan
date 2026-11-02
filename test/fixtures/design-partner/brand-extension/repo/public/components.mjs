export class AcmeCard extends HTMLElement{connectedCallback(){this.classList.add("acme-card");this.style.display="block"}}
customElements.define("acme-card",AcmeCard);
