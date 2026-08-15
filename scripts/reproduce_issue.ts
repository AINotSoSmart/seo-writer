
import { editorJsToMarkdown } from '../lib/editorjs-to-markdown';

const testData = {
    blocks: [
        {
            type: 'paragraph',
            data: {
                text: 'This is <b>bold</b> and this is <i>italic</i>.'
            }
        },
        {
            type: 'paragraph',
            data: {
                // Test with attributes
                text: 'This is <b class="cdx-bold">bold with class</b>.'
            }
        },
        {
            type: 'paragraph',
            data: {
                // Test specific marker tool tag if any, mostly it is 'mark'
                text: 'This is <mark class="cdx-marker">highlighted</mark>.'
            }
        },
        {
            type: 'paragraph',
            data: {
                // Test span based??
                text: 'This is <span style="font-weight: bold;">bold span</span>.'
            }
        }
    ]
};

console.log(" Converting... ");
const md = editorJsToMarkdown(testData as any);
console.log("------------------------------------------");
console.log(md);
console.log("------------------------------------------");
