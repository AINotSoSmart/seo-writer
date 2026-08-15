
import { editorJsToMarkdown } from '../lib/editorjs-to-markdown';

const testCases = [
    {
        name: "Basic Bold",
        input: {
            time: 1630000000000,
            blocks: [
                {
                    type: "paragraph",
                    data: {
                        text: "This is <b>bold</b> text."
                    }
                }
            ],
            version: "2.22.2"
        },
        expected: "This is **bold** text.\n\n"
    },
    {
        name: "Attribute Bold",
        input: {
            time: 1630000000000,
            blocks: [
                {
                    type: "paragraph",
                    data: {
                        text: "This is <b class=\"cdx-bold\">bold with class</b> text."
                    }
                }
            ],
            version: "2.22.2"
        },
        expected: "This is **bold with class** text.\n\n"
    },
    {
        name: "Strong Tag",
        input: {
            time: 1630000000000,
            blocks: [
                {
                    type: "paragraph",
                    data: {
                        text: "This is <strong>strong</strong> text."
                    }
                }
            ],
            version: "2.22.2"
        },
        expected: "This is **strong** text.\n\n"
    },
    {
        name: "Italic with Attributes",
        input: {
            time: 1630000000000,
            blocks: [
                {
                    type: "paragraph",
                    data: {
                        text: "This is <i style=\"color: red;\">italic</i> text."
                    }
                }
            ],
            version: "2.22.2"
        },
        expected: "This is _italic_ text.\n\n"
    },
    {
        name: "Underline",
        input: {
            time: 1630000000000,
            blocks: [
                {
                    type: "paragraph",
                    data: {
                        text: "This is <u>underlined</u> text."
                    }
                }
            ],
            version: "2.22.2"
        },
        expected: "This is <u>underlined</u> text.\n\n" // Markdown doesn't standardly support underline, but we usually keep HTML or specific syntax. Let's see if we want to keep it as HTML or convert. Plan says support it.
    },
    {
        name: "Link with Attributes",
        input: {
            time: 1630000000000,
            blocks: [
                {
                    type: "paragraph",
                    data: {
                        text: "Click <a href=\"https://google.com\" target=\"_blank\">here</a>."
                    }
                }
            ],
            version: "2.22.2"
        },
        expected: "Click [here](https://google.com).\n\n"
    },
    {
        name: "Multiline Bold",
        input: {
            time: 1630000000000,
            blocks: [
                {
                    type: "paragraph",
                    data: {
                        text: "This is <b>bold\nacross lines</b>."
                    }
                }
            ],
            version: "2.22.2"
        },
        expected: "This is **bold\nacross lines**.\n\n"
    },
    {
        name: "HTML Table in Paragraph",
        input: {
            time: 1630000000000,
            blocks: [
                {
                    type: "paragraph",
                    data: {
                        text: "<table class=\"editor-table\"><thead><tr><th>Name</th><th>Role</th></tr></thead><tbody><tr><td>Alice</td><td>Admin</td></tr><tr><td>Bob</td><td>User</td></tr></tbody></table>"
                    }
                }
            ],
            version: "2.22.2"
        },
        expected: "| Name | Role |\n| --- | --- |\n| Alice | Admin |\n| Bob | User |\n\n"
    }

];

console.log("Running Markdown Conversion Tests...\n");

let failedCount = 0;

testCases.forEach(test => {
    const result = editorJsToMarkdown(test.input);
    if (result !== test.expected) {
        console.error(`[FAIL] ${test.name}`);
        console.error(`  Expected: ${JSON.stringify(test.expected)}`);
        console.error(`  Received: ${JSON.stringify(result)}`);
        failedCount++;
    } else {
        console.log(`[PASS] ${test.name}`);
    }
});

if (failedCount > 0) {
    console.log(`\n${failedCount} tests failed.`);
    process.exit(1);
} else {
    console.log("\nAll tests passed!");
}
