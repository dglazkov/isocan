/** The built-in menu and dispatch metadata, available synchronously without loading agent instructions. */
export declare const DEFAULT_COMMAND_CATALOGUE: readonly [{
    readonly name: "help";
    readonly description: "Keyboard shortcuts, and what else you can ask for";
    readonly usage: "";
    readonly source: "built-in";
    readonly local: true;
}, {
    readonly name: "accessibility-audit";
    readonly description: "Audit selected screens against WCAG — from the real HTML, not a picture";
    readonly usage: "[what to focus on]";
    readonly source: "built-in";
}, {
    readonly name: "app-store-assets";
    readonly description: "Icon, three marketing screenshots, and the ASO metadata";
    readonly usage: "[what to emphasise]";
    readonly source: "built-in";
}, {
    readonly name: "web-assets";
    readonly description: "Favicon, Apple touch icon, and a manifest.json";
    readonly usage: "[what to emphasise]";
    readonly source: "built-in";
}, {
    readonly name: "marketing-kit";
    readonly description: "Social card, banner, email header, and the copy to go with them";
    readonly usage: "[the angle to take]";
    readonly source: "built-in";
}, {
    readonly name: "design-audit";
    readonly description: "Review a screen's craft and copy against the design system, then offer to fix it";
    readonly usage: "[what to look at]";
    readonly source: "built-in";
}, {
    readonly name: "design-system";
    readonly description: "Write down what this canvas has decided things look like — a DESIGN.md";
    readonly usage: "[what to change]";
    readonly source: "built-in";
}, {
    readonly name: "skill";
    readonly description: "Find a published skill, or add one to this canvas";
    readonly usage: "find <what you want> | add <owner/repo/path>";
    readonly source: "built-in";
}, {
    readonly name: "cancel";
    readonly description: "Call off what was asked here — stop, say where you got to";
    readonly usage: "[why, or what to do instead]";
    readonly source: "built-in";
}, {
    readonly name: "tidy";
    readonly aka: readonly ["format"];
    readonly description: "Tidy the canvas — grid (default), smart, or your own instructions";
    readonly usage: "[grid|smart|note]";
    readonly source: "built-in";
}, {
    readonly name: "variation";
    readonly description: "Make N variations of a screen, each explored differently";
    readonly usage: "[n=3] <how they should differ>";
    readonly source: "built-in";
}, {
    readonly name: "grill-me";
    readonly description: "A relentless interview that ends in a spec, not a vibe";
    readonly usage: "[what you want to build]";
    readonly source: "built-in";
}, {
    readonly name: "sprint";
    readonly description: "Run a design sprint here — you facilitate, people and agents sketch, one person decides";
    readonly usage: "[what we are designing] | <phase> [8m] [note]";
    readonly source: "built-in";
}];
