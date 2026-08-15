
import { marked } from "marked";

const markdown = "**bold** and _italic_";
const html = marked.parseInline(markdown);
console.log(`Markdown: ${markdown}`);
console.log(`HTML: ${html}`);
