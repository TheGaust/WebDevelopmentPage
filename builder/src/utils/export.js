export function exportProject(project) {
    if (!project || !project.elements) {
        alert("Projeto vazio ou inválido");
        return;
    }

    const { elements, canvas } = project;

        let css = `
            html, body {
                margin: 0;
                padding: 0;
                width: 100%;
                height: 100%;
                overflow-x: hidden;
                font-family: sans-serif;
            }

            .page-root {
                position: relative;
                width: 100%;
                min-height: 100vh;
                box-sizing: border-box;
                background: white;
                padding: 0;
                overflow-x: hidden;
            }

            .el {
                position: absolute;
                box-sizing: border-box;
                display: block;
            }

            .header-fixed {
                position: fixed !important;
                top: 0;
                left: 0;
                width: 100% !important;
                z-index: 999;
            }

            .footer-fixed {
                position: fixed !important;
                bottom: 0;
                left: 0;
                width: 100% !important;
                z-index: 999;
            }

            @media (max-width: 768px) {
                .el {
                        position: relative !important;
                        left: 0 !important;
                        top: 0 !important;
                        transform: none !important;
                        width: 100% !important;
                        margin: 10px 0;
                }
            }
        `;

    // HTML
    let html = `
            <div class="page-root">
    `;

    elements.forEach(el => {
        const cls = `el-${el.id}`;

        const s = el.styles || {};

        // monta CSS individual
        let styleCSS = `
            .${cls} {
                    left: ${el.position.x}px;
                    top: ${el.position.y}px;
                    width: ${s.width || 'auto'};
                    height: ${s.height || 'auto'};
                    padding: ${s.padding || '0'};
                    background: ${s.background || 'transparent'};
                    color: ${s.color || '#000'};
                    font-size: ${s.fontSize || '16px'};
                    font-family: ${s.fontFamily || 'sans-serif'};
                    border-radius: ${s.borderRadius || '0'};
                    box-shadow: ${s.boxShadow || 'none'};
                    text-align: ${s.textAlign || 'left'};
                    transform: translate(0,0);
            }
        `;

        css += styleCSS + "\n";

        // Agora gera HTML baseado no tipo
        if (el.type === "text") {
            html += `<div class="el ${cls}">${escape(el.content)}</div>\n`;
        }

        else if (el.type === "button") {
            const href = el.href || "";
            const target = el.openNewTab ? `_blank` : `_self`;

            html += `
                <a href="${href}" target="${target}" class="el ${cls}">
                    ${escape(el.content || "Button")}
                </a>
            `;
        }

        else if (el.type === "image") {
            html += `
                <img class="el ${cls}" src="${el.content || ""}" alt="image"/>
            `;
        }

        else if (el.type === "header") {
            html += `<div class="el ${cls} header-fixed">${escape(el.content || "")}</div>`;
        }

        else if (el.type === "footer") {
            html += `<div class="el ${cls} footer-fixed">${escape(el.content || "")}</div>`;
        }

        else {
            html += `<div class="el ${cls}"></div>`;
        }
    });

    html += `</div>`;

    // Abre preview
    const w = window.open();
    w.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8"/>
            <meta name="viewport" content="width=device-width, initial-scale=1"/>
            <title>Export</title>
            <style>${css}</style>
        </head>
        <body>${html}</body>
        </html>
    `);
    w.document.close();
}

function escape(str) {
    return (str || "")
        .replace(/&/g,"&amp;")
        .replace(/</g,"&lt;")
        .replace(/>/g,"&gt;");
}