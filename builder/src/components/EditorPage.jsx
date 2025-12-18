import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import interact from "interactjs";
import { HexColorPicker, HexColorInput } from "react-colorful";
import { loadProjectById, saveProject } from "../utils/storage";

/**
 * EditorPage.jsx
 * - Drag & resize (interactjs) com grid
 * - Breakpoints: Desktop / Notebook / Tablet / Celular
 * - Canvas reduz sem barra de rolagem horizontal
 * - Overrides por breakpoint (layout diferente por resolução)
 * - Linhas-guia temporárias + magnetismo entre elementos
 * - Export com @media por breakpoint usando o mesmo layout do editor
 */

const BREAKPOINTS = {
  desktop: { key: "desktop", label: "Desktop", previewWidth: 1280 },
  laptop: { key: "laptop", label: "Notebook", previewWidth: 1024, maxWidth: 1024 },
  tablet: { key: "tablet", label: "Tablet", previewWidth: 768, maxWidth: 768 },
  mobile: { key: "mobile", label: "Celular", previewWidth: 414, maxWidth: 480 },
};

const GRID_SIZE = 10;
const SNAP_THRESHOLD = 5;

function splitSize(value, fallbackUnit = "px") {
  if (!value) return { num: "", unit: fallbackUnit };
  if (value === "auto") return { num: "auto", unit: "auto" };
  const m = String(value).trim().match(/^(-?\d*\.?\d+)([a-z%]+)?$/i);
  if (!m) return { num: value, unit: fallbackUnit };
  return { num: m[1], unit: m[2] || fallbackUnit };
}

function SizeInput({
  label,
  value,
  onChange,
  units = ["px", "%", "rem", "em", "vw", "vh", "auto"],
  placeholder = "ex: 16",
}) {
  const { num, unit } = splitSize(value);

  function setNum(n) {
    if (unit === "auto") {
      onChange("auto");
      return;
    }
    if (n === "") {
      onChange("");
      return;
    }
    onChange(`${n}${unit}`);
  }

  function setUnit(u) {
    if (u === "auto") {
      onChange("auto");
      return;
    }
    if (num === "auto") {
      onChange(`0${u}`);
      return;
    }
    if (num === "") {
      onChange("");
      return;
    }
    onChange(`${num}${u}`);
  }

  return (
    <div className="mb-2">
      <label className="block text-xs mb-1">{label}</label>
      <div className="flex gap-2">
        <input
          className="input flex-1"
          type="text"
          value={num}
          onChange={(e) => setNum(e.target.value)}
          placeholder={placeholder}
          disabled={unit === "auto"}
        />
        <select
          className="input w-20"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
        >
          {units.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function escapeHtml(str) {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Retorna posição + estilos efetivos considerando override do breakpoint.
 * Para notebook/tablet/mobile, se não há override, escala a partir do desktop,
 * simulando o comportamento responsivo (left/width em % no export).
 */
function getEffectiveLayout(element, breakpoint) {
  const basePosition = element.position || { x: 0, y: 0 };
  const baseStyles = element.styles || {};

  const baseCanvasWidth = BREAKPOINTS.desktop.previewWidth; // 1280
  const targetCanvasWidth =
    BREAKPOINTS[breakpoint]?.previewWidth || baseCanvasWidth;
  const scale = targetCanvasWidth / baseCanvasWidth;

  const responsive = element.responsive || {};

  if (breakpoint === "desktop") {
    return { position: basePosition, styles: baseStyles };
  }

  const override = responsive[breakpoint];

  // Sem override: aplica escala horizontal, mantém Y original.
  if (!override) {
    let width = baseStyles.width;

    if (typeof width === "string") {
      const m = width.match(/^(-?\d*\.?\d+)px$/);
      if (m) {
        const px = parseFloat(m[1]) || 0;
        width = `${px * scale}px`;
      }
    }

    return {
      position: { x: basePosition.x * scale, y: basePosition.y },
      styles: { ...baseStyles, width },
    };
  }

  // Com override: mescla estilos base + override e usa posição override
  const mergedStyles = { ...baseStyles, ...(override.styles || {}) };
  const pos = override.position || basePosition;
  return { position: pos, styles: mergedStyles };
}

export default function EditorPage() {
  const nav = useNavigate();
  const { projectId } = useParams();

  const user = localStorage.getItem("pagebuilder:user");
  const [title, setTitle] = useState("Página sem título");

  const [elements, setElements] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [pageHeight, setPageHeight] = useState(640);

  const [currentBreakpoint, setCurrentBreakpoint] = useState("desktop");

  const [showBgPicker, setShowBgPicker] = useState(false);
  const [showTextColorPicker, setShowTextColorPicker] = useState(false);

  const editorRef = useRef(null);
  const idCounter = useRef(1);

  // Para magnetismo/linhas-guia
  const [guides, setGuides] = useState({ vertical: [], horizontal: [] });
  const elementsRef = useRef(elements);

  useEffect(() => {
    elementsRef.current = elements;
  }, [elements]);

  // --- LOAD PROJECT ---
  useEffect(() => {
    if (!user) {
      nav("/");
      return;
    }
    if (!projectId) return;

    const proj = loadProjectById(user, projectId);
    if (proj?.structure?.elements) {
      setTitle(proj.title || "Página sem título");
      setElements(proj.structure.elements || []);
      setPageHeight(proj.structure.pageHeight || 640);

      const maxNum = (proj.structure.elements || [])
        .map((e) => parseInt(String(e.id).replace(/[^\d]/g, ""), 10))
        .filter((n) => !isNaN(n))
        .reduce((a, b) => Math.max(a, b), 0);
      idCounter.current = maxNum + 1;
    }
  }, [user, projectId, nav]);

  // Fecha color pickers quando muda seleção
  useEffect(() => {
    setShowBgPicker(false);
    setShowTextColorPicker(false);
  }, [selectedId]);

  // --- INTERACT SETUP (drag + resize + grid + magnetismo) ---
  useEffect(() => {
    const interactable = interact(".draggable");

    interactable
      .draggable({
        listeners: {
          move(event) {
            const target = event.target;
            const id = target.getAttribute("data-id");
            const type = target.getAttribute("data-type");
            if (!id || type === "header" || type === "footer") return;

            let x =
              (parseFloat(target.getAttribute("data-x")) || 0) + event.dx;
            let y =
              (parseFloat(target.getAttribute("data-y")) || 0) + event.dy;

            const canvas = editorRef.current;
            const otherElements = elementsRef.current.filter(
              (el) => el.id !== id
            );

            const verticalGuides = [];
            const horizontalGuides = [];

            const elWidth = target.offsetWidth;
            const elHeight = target.offsetHeight;

            // Magnetismo com centro do canvas
            if (canvas) {
              const canvasWidth = canvas.clientWidth;
              const centerCanvas = canvasWidth / 2;
              const centerElX = x + elWidth / 2;
              if (Math.abs(centerElX - centerCanvas) <= SNAP_THRESHOLD) {
                x = centerCanvas - elWidth / 2;
                verticalGuides.push(centerCanvas);
              }
            }

            // Magnetismo com outros elementos (top/center Y e left/center X)
            otherElements.forEach((el) => {
              const layout = getEffectiveLayout(el, currentBreakpoint);
              const pos = layout.position || { x: 0, y: 0 };
              const st = layout.styles || {};

              let otherWidth = elWidth;
              if (typeof st.width === "string") {
                const m = st.width.match(/^(-?\d*\.?\d+)px$/);
                if (m) otherWidth = parseFloat(m[1]) || otherWidth;
              }

              let otherHeight = elHeight;
              if (typeof st.height === "string") {
                const m = st.height.match(/^(-?\d*\.?\d+)px$/);
                if (m) otherHeight = parseFloat(m[1]) || otherHeight;
              }

              // Alinhar topo (Y)
              if (Math.abs(y - pos.y) <= SNAP_THRESHOLD) {
                y = pos.y;
                horizontalGuides.push(pos.y);
              }

              // Alinhar centro vertical
              const thisCenterY = y + elHeight / 2;
              const otherCenterY = pos.y + otherHeight / 2;
              if (Math.abs(thisCenterY - otherCenterY) <= SNAP_THRESHOLD) {
                y = otherCenterY - elHeight / 2;
                horizontalGuides.push(otherCenterY);
              }

              // Alinhar esquerda (X)
              if (Math.abs(x - pos.x) <= SNAP_THRESHOLD) {
                x = pos.x;
                verticalGuides.push(pos.x);
              }

              // Alinhar centro horizontal
              const thisCenterX = x + elWidth / 2;
              const otherCenterX = pos.x + otherWidth / 2;
              if (Math.abs(thisCenterX - otherCenterX) <= SNAP_THRESHOLD) {
                x = otherCenterX - elWidth / 2;
                verticalGuides.push(otherCenterX);
              }
            });

            setGuides({
              vertical: verticalGuides,
              horizontal: horizontalGuides,
            });

            target.style.transform = `translate(${x}px, ${y}px)`;
            target.setAttribute("data-x", x);
            target.setAttribute("data-y", y);

            setElements((prev) =>
              prev.map((el) => {
                if (el.id !== id) return el;
                const next = { ...el };

                if (currentBreakpoint === "desktop") {
                  next.position = { x, y };
                } else {
                  const responsive = { ...(next.responsive || {}) };
                  const cur = responsive[currentBreakpoint] || {};
                  responsive[currentBreakpoint] = {
                    ...cur,
                    position: { x, y },
                    styles: { ...(cur.styles || {}) },
                  };
                  next.responsive = responsive;
                }

                return next;
              })
            );
          },
          end() {
            setGuides({ vertical: [], horizontal: [] });
          },
        },
        modifiers: [
          interact.modifiers.snap({
            targets: [interact.snappers.grid({ x: GRID_SIZE, y: GRID_SIZE })],
            range: GRID_SIZE / 2,
            relativePoints: [{ x: 0, y: 0 }],
          }),
          interact.modifiers.restrictRect({
            restriction: "parent",
            endOnly: true,
          }),
        ],
      })
      .resizable({
        edges: { left: true, right: true, bottom: true, top: true },
        listeners: {
          move(event) {
            const target = event.target;
            const id = target.getAttribute("data-id");
            const type = target.getAttribute("data-type");
            if (!id || type === "header" || type === "footer") return;

            let x = parseFloat(target.getAttribute("data-x")) || 0;
            let y = parseFloat(target.getAttribute("data-y")) || 0;

            const width = `${event.rect.width}px`;
            const height = `${event.rect.height}px`;

            target.style.width = width;
            target.style.height = height;

            x += event.deltaRect.left;
            y += event.deltaRect.top;

            target.style.transform = `translate(${x}px, ${y}px)`;
            target.setAttribute("data-x", x);
            target.setAttribute("data-y", y);

            setElements((prev) =>
              prev.map((el) => {
                if (el.id !== id) return el;
                const next = { ...el };

                if (currentBreakpoint === "desktop") {
                  next.styles = {
                    ...(next.styles || {}),
                    width,
                    height,
                  };
                  next.position = { x, y };
                } else {
                  const responsive = { ...(next.responsive || {}) };
                  const cur = responsive[currentBreakpoint] || {};
                  responsive[currentBreakpoint] = {
                    ...cur,
                    position: { x, y },
                    styles: {
                      ...(cur.styles || {}),
                      width,
                      height,
                    },
                  };
                  next.responsive = responsive;
                }

                return next;
              })
            );
          },
          end() {
            setGuides({ vertical: [], horizontal: [] });
          },
        },
        modifiers: [
          interact.modifiers.snap({
            targets: [interact.snappers.grid({ x: GRID_SIZE, y: GRID_SIZE })],
            range: GRID_SIZE / 2,
            relativePoints: [{ x: 0, y: 0 }],
          }),
          interact.modifiers.restrictSize({
            min: { width: 20, height: 20 },
          }),
          interact.modifiers.restrictEdges({
            outer: "parent",
          }),
        ],
      });

    return () => {
      interactable.unset();
    };
  }, [currentBreakpoint]);

  // --- ELEMENT CRUD ---
  function addElement(type) {
    const id = `c${idCounter.current++}`;
    const isBar = type === "header" || type === "footer";

    const base = {
      id,
      type,
      content:
        type === "text"
          ? "Texto"
          : type === "button"
          ? "Clique"
          : type === "header"
          ? ""
          : type === "footer"
          ? ""
          : "",
      styles: {
        width: isBar ? "100%" : "160px",
        height: isBar ? "80px" : type === "text" ? "auto" : "60px",
        background:
          type === "button"
            ? "#1f2937"
            : isBar
            ? "#f1f5f9"
            : "transparent",
        color: type === "button" ? "#ffffff" : "#111827",
        padding: "8px",
        fontSize: type === "text" || type === "button" ? "16px" : "",
        fontFamily: "Arial",
        borderRadius: isBar ? "0px" : "0px",
        boxShadow: "",
      },
      position: {
        x: isBar ? 0 : 20,
        y: isBar ? (type === "footer" ? pageHeight - 80 : 0) : 20,
      },
      meta: {},
      responsive: {},
    };

    setElements((prev) => [...prev, base]);
    setSelectedId(id);
  }

  function updateSelected(changes) {
    setElements((prev) =>
      prev.map((el) => {
        if (el.id !== selectedId) return el;
        const next = { ...el };

        if (changes.content !== undefined) {
          next.content = changes.content;
        }

        if (changes.meta) {
          next.meta = { ...(next.meta || {}), ...changes.meta };
        }

        if (changes.styles) {
          if (currentBreakpoint === "desktop") {
            next.styles = {
              ...(next.styles || {}),
              ...changes.styles,
            };
          } else {
            const responsive = { ...(next.responsive || {}) };
            const cur = responsive[currentBreakpoint] || {};
            responsive[currentBreakpoint] = {
              ...cur,
              styles: {
                ...(cur.styles || {}),
                ...changes.styles,
              },
            };
            next.responsive = responsive;
          }
        }

        return next;
      })
    );
  }

  function removeSelected() {
    setElements((prev) => prev.filter((el) => el.id !== selectedId));
    setSelectedId(null);
  }

  // --- SAVE / EXPORT ---
  function buildProjectObj() {
    const id = projectId || `p_${Date.now()}`;
    return {
      id,
      title,
      thumbnail: "",
      updatedAt: new Date().toISOString(),
      structure: { elements, pageHeight },
    };
  }

  function onSave() {
    const proj = buildProjectObj();
    saveProject(user, proj);
    if (!projectId) nav(`/editor/${proj.id}`, { replace: true });
    alert("Projeto salvo!");
  }

  // helper pra converter width px -> %
  function widthToPercent(widthValue, designWidth) {
    if (!widthValue) return "";
    const m = String(widthValue).match(/^(-?\d*\.?\d+)(px)$/);
    if (m) {
      const px = parseFloat(m[1]) || 0;
      const wPercent = (px / designWidth) * 100;
      return `width:${wPercent}%;`;
    }
    return `width:${widthValue};`;
  }

  // --- EXPORT HTML ---
  function exportHTML() {
    const DESIGN_WIDTHS = {
      desktop: BREAKPOINTS.desktop.previewWidth,
      laptop: BREAKPOINTS.laptop.previewWidth,
      tablet: BREAKPOINTS.tablet.previewWidth,
      mobile: BREAKPOINTS.mobile.previewWidth,
    };

    let css = `
      html, body {
        margin: 0;
        padding: 0;
        width: 100%;
        min-height: 100%;
        overflow-x: hidden;
      }

      .page-root {
        width: 100%;
        min-height: 100vh;
        box-sizing: border-box;
      }

      .canvas-area {
        position: relative;
        width: 100%;
        max-width: ${DESIGN_WIDTHS.desktop}px;
        margin: 0 auto;
        min-height: ${pageHeight}px;
      }
    `;

    let html = `
      <div class="page-root">
        <div class="canvas-area">
    `;

    let baseElementsCss = "";
    const bpCss = { laptop: "", tablet: "", mobile: "" };

    elements.forEach((el) => {
      const className = el.id;
      const isHeader = el.type === "header";
      const isFooter = el.type === "footer";

      // --- HTML ---
      if (el.type === "button") {
        if (el.meta?.href) {
          html += `          <a class="${className}" href="${el.meta.href}"${
            el.meta.target ? ` target="${el.meta.target}"` : ""
          }>${escapeHtml(el.content || "")}</a>\n`;
        } else {
          html += `          <button class="${className}">${escapeHtml(
            el.content || ""
          )}</button>\n`;
        }
      } else if (el.type === "image") {
        html += `          <img class="${className}" src="${
          el.content || ""
        }" alt="" />\n`;
      } else if (el.type === "text") {
        html += `          <div class="${className}">${escapeHtml(
          el.content || ""
        )}</div>\n`;
      } else {
        html += `          <div class="${className}"></div>\n`;
      }

      // --- CSS base (desktop) ---
      const desktopLayout = getEffectiveLayout(el, "desktop");
      const basePos = desktopLayout.position || { x: 0, y: 0 };
      const baseStyles = desktopLayout.styles || {};

      if (isHeader || isFooter) {
        const h =
          baseStyles.height && baseStyles.height !== "auto"
            ? `height:${baseStyles.height};`
            : "";
        const bg = baseStyles.background
          ? `background:${baseStyles.background};`
          : "";
        const color = baseStyles.color ? `color:${baseStyles.color};` : "";
        const pad = baseStyles.padding ? `padding:${baseStyles.padding};` : "";
        const fs = baseStyles.fontSize
          ? `font-size:${baseStyles.fontSize};`
          : "";
        const ff = baseStyles.fontFamily
          ? `font-family:${baseStyles.fontFamily};`
          : "";
        const radius = baseStyles.borderRadius
          ? `border-radius:${baseStyles.borderRadius};`
          : "";
        const shadow = baseStyles.boxShadow
          ? `box-shadow:${baseStyles.boxShadow};`
          : "";

        baseElementsCss += `
          .${className} {
            position: fixed;
            left: 0;
            ${isHeader ? "top:0;" : "bottom:0;"}
            width: 100%;
            ${h}
            ${bg}
            ${color}
            ${pad}
            ${fs}
            ${ff}
            display: flex;
            align-items: center;
            justify-content: center;
            ${radius}
            ${shadow}
            box-sizing: border-box;
            z-index: 999;
          }
        `;
        return; // header/footer não têm overrides por breakpoint por enquanto
      }

      // não-header/footer
      const desktopWidth = DESIGN_WIDTHS.desktop;
      const leftPercent = (basePos.x / desktopWidth) * 100;
      const widthCssBase = widthToPercent(baseStyles.width, desktopWidth);

      const h =
        baseStyles.height && baseStyles.height !== "auto"
          ? `height:${baseStyles.height};`
          : "";
      const bg = baseStyles.background
        ? `background:${baseStyles.background};`
        : "";
      const color = baseStyles.color ? `color:${baseStyles.color};` : "";
      const pad = baseStyles.padding ? `padding:${baseStyles.padding};` : "";
      const fs = baseStyles.fontSize ? `font-size:${baseStyles.fontSize};` : "";
      const ff = baseStyles.fontFamily
        ? `font-family:${baseStyles.fontFamily};`
        : "";
      const radius = baseStyles.borderRadius
        ? `border-radius:${baseStyles.borderRadius};`
        : "";
      const shadow = baseStyles.boxShadow
        ? `box-shadow:${baseStyles.boxShadow};`
        : "";

      baseElementsCss += `
        .${className} {
          position: absolute;
          left: ${leftPercent}%;
          top: ${basePos.y}px;
          ${widthCssBase}
          ${h}
          ${bg}
          ${color}
          ${pad}
          ${fs}
          ${ff}
          display: flex;
          align-items: center;
          justify-content: center;
          ${radius}
          ${shadow}
          box-sizing: border-box;
          z-index: 1;
          ${
            el.type === "button"
              ? "cursor:pointer;text-decoration:none;border:none;"
              : ""
          }
        }
      `;

      // --- Overrides por breakpoint (usando o mesmo layout do editor) ---
      ["laptop", "tablet", "mobile"].forEach((bp) => {
        const ov = el.responsive && el.responsive[bp];
        if (!ov) return; // só gera CSS se houve override nesse breakpoint

        const layoutBp = getEffectiveLayout(el, bp);
        const posBp = layoutBp.position || basePos;
        const stylesBp = layoutBp.styles || baseStyles;
        const bpWidth = DESIGN_WIDTHS[bp];

        const leftPercentBp = (posBp.x / bpWidth) * 100;
        const widthCssBp = widthToPercent(stylesBp.width, bpWidth);

        const hBp =
          stylesBp.height && stylesBp.height !== "auto"
            ? `height:${stylesBp.height};`
            : "";
        const bgBp = stylesBp.background
          ? `background:${stylesBp.background};`
          : "";
        const colorBp = stylesBp.color ? `color:${stylesBp.color};` : "";
        const padBp = stylesBp.padding ? `padding:${stylesBp.padding};` : "";
        const fsBp = stylesBp.fontSize
          ? `font-size:${stylesBp.fontSize};`
          : "";
        const ffBp = stylesBp.fontFamily
          ? `font-family:${stylesBp.fontFamily};`
          : "";
        const radiusBp = stylesBp.borderRadius
          ? `border-radius:${stylesBp.borderRadius};`
          : "";
        const shadowBp = stylesBp.boxShadow
          ? `box-shadow:${stylesBp.boxShadow};`
          : "";

        const cssBlock = `
          .${className} {
            left: ${leftPercentBp}%;
            top: ${posBp.y}px;
            ${widthCssBp}
            ${hBp}
            ${bgBp}
            ${colorBp}
            ${padBp}
            ${fsBp}
            ${ffBp}
            ${radiusBp}
            ${shadowBp}
          }
        `;

        bpCss[bp] += cssBlock;
      });
    });

    html += `
        </div>
      </div>
    `;

    css += baseElementsCss;

    // Ordem importa: laptop -> tablet -> mobile (mobile por último)
    if (bpCss.laptop) {
      css += `
        @media (max-width: ${
          BREAKPOINTS.laptop.maxWidth || DESIGN_WIDTHS.laptop
        }px) {
          ${bpCss.laptop}
        }
      `;
    }
    if (bpCss.tablet) {
      css += `
        @media (max-width: ${
          BREAKPOINTS.tablet.maxWidth || DESIGN_WIDTHS.tablet
        }px) {
          ${bpCss.tablet}
        }
      `;
    }
    if (bpCss.mobile) {
      css += `
        @media (max-width: ${
          BREAKPOINTS.mobile.maxWidth || DESIGN_WIDTHS.mobile
        }px) {
          ${bpCss.mobile}
        }
      `;
    }

    const full = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
${css}
    </style>
  </head>
  <body>
${html}
  </body>
</html>
    `.trim();

    const w = window.open();
    if (w) {
      w.document.write(full);
      w.document.close();
    }

    prompt("HTML completo (copie tudo):", full);
  }

  // --- RENDER ELEMENTS ---
  function renderElement(el) {
    const isSticky = el.type === "header" || el.type === "footer";
    const layout = getEffectiveLayout(el, currentBreakpoint);
    const styles = layout.styles || {};
    const pos = layout.position || { x: 0, y: 0 };

    const inlineStyles = {
      width: styles.width,
      height: styles.height === "auto" ? undefined : styles.height,
      background: styles.background,
      color: styles.color,
      padding: styles.padding,
      fontSize: styles.fontSize,
      fontFamily: styles.fontFamily,
      borderRadius: styles.borderRadius,
      boxShadow: styles.boxShadow,
      boxSizing: "border-box",
      position: isSticky ? "sticky" : "absolute",
      top: el.type === "header" ? 0 : isSticky ? undefined : 0,
      bottom: el.type === "footer" ? 0 : undefined,
      left: 0,
      transform: isSticky
        ? "none"
        : `translate(${pos.x || 0}px, ${pos.y || 0}px)`,
      zIndex: isSticky ? 50 : 1,
      cursor: isSticky ? "default" : "move",
      userSelect: "none",
    };

    return (
      <div
        key={el.id}
        className={`draggable editor-element ${
          selectedId === el.id ? "selected" : ""
        }`}
        data-id={el.id}
        data-type={el.type}
        data-x={pos.x || 0}
        data-y={pos.y || 0}
        onMouseDown={(e) => {
          e.stopPropagation();
          setSelectedId(el.id);
        }}
        style={inlineStyles}
      >
        {el.type === "text" && (
          <div style={{ whiteSpace: "pre-wrap" }}>{el.content}</div>
        )}
        {el.type === "div" && <div style={{ width: "100%", height: "100%" }} />}
        {el.type === "button" && (
          <button
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              background: "transparent",
              color: styles.color,
              fontSize: styles.fontSize,
              fontFamily: styles.fontFamily,
            }}
          >
            {el.content}
          </button>
        )}
        {el.type === "image" && (
          <img
            src={el.content || "https://via.placeholder.com/150"}
            alt="img"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
        {el.type === "header" && <div className="w-full h-full" />}
        {el.type === "footer" && <div className="w-full h-full" />}
      </div>
    );
  }

  const selectedEl = elements.find((e) => e.id === selectedId);
  const selectedLayout =
    selectedEl && getEffectiveLayout(selectedEl, currentBreakpoint);

  const currentBreakpointConfig = BREAKPOINTS[currentBreakpoint];

  return (
    <div className="min-h-screen p-4 bg-gray-50">
      <div className="flex gap-4">
        {/* Sidebar */}
        <div className="w-80 p-3 bg-white rounded shadow">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">Toolbar</h3>
            <button
              onClick={() => nav("/projects")}
              className="text-sm text-slate-600 hover:underline"
            >
              voltar
            </button>
          </div>

          <label className="block text-xs mb-1">Título</label>
          <input
            className="w-full mb-3 input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <label className="block text-xs mb-1">Altura da página (px)</label>
          <input
            type="number"
            className="w-full mb-3 input"
            value={pageHeight}
            min="400"
            max="4000"
            onChange={(e) =>
              setPageHeight(
                Math.min(4000, Math.max(400, Number(e.target.value) || 0))
              )
            }
          />

          {/* Breakpoint selector */}
          <div className="mb-3">
            <label className="block text-xs mb-1">
              Modo de visualização (breakpoint)
            </label>
            <div className="flex flex-wrap gap-2">
              {Object.values(BREAKPOINTS).map((bp) => (
                <button
                  key={bp.key}
                  type="button"
                  onClick={() => setCurrentBreakpoint(bp.key)}
                  className={`px-2 py-1 rounded text-xs border ${
                    currentBreakpoint === bp.key
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-slate-700 border-slate-300"
                  }`}
                >
                  {bp.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              className="px-3 py-1 bg-blue-600 text-white rounded"
              onClick={() => addElement("div")}
            >
              Container
            </button>
            <button
              className="px-3 py-1 bg-green-600 text-white rounded"
              onClick={() => addElement("text")}
            >
              Text
            </button>
            <button
              className="px-3 py-1 bg-indigo-600 text-white rounded"
              onClick={() => addElement("image")}
            >
              Image
            </button>
            <button
              className="px-3 py-1 bg-gray-800 text-white rounded"
              onClick={() => addElement("button")}
            >
              Button
            </button>
            <button
              className="px-3 py-1 bg-purple-600 text-white rounded"
              onClick={() => addElement("header")}
            >
              Header
            </button>
            <button
              className="px-3 py-1 bg-purple-800 text-white rounded"
              onClick={() => addElement("footer")}
            >
              Footer
            </button>
          </div>

          <hr className="my-3" />

          <h4 className="font-medium">Selected</h4>

          {selectedEl && selectedLayout ? (
            <div className="mt-2">
              <div className="text-xs text-slate-600 mb-1">
                ID: {selectedEl.id} ({selectedEl.type}) — editando{" "}
                <span className="font-semibold">
                  {BREAKPOINTS[currentBreakpoint].label}
                </span>
              </div>

              <SizeInput
                label="Width"
                value={selectedLayout.styles?.width || ""}
                onChange={(v) => updateSelected({ styles: { width: v } })}
              />
              <SizeInput
                label="Height"
                value={selectedLayout.styles?.height || ""}
                onChange={(v) => updateSelected({ styles: { height: v } })}
                units={["px", "%", "rem", "em", "vh", "auto"]}
              />

              {/* Background Color */}
              <label className="block text-xs mb-1">Background</label>
              <div className="mb-2 relative">
                <button
                  type="button"
                  onClick={() => setShowBgPicker((v) => !v)}
                  className="w-full input flex items-center gap-2 justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-5 h-5 rounded-full border"
                      style={{
                        background:
                          selectedLayout.styles?.background || "#ffffff",
                      }}
                    />
                    <span className="text-sm">
                      {(
                        selectedLayout.styles?.background || "#ffffff"
                      ).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">
                    clique para escolher
                  </span>
                </button>

                {showBgPicker && (
                  <div className="absolute right-0 mt-2 z-50 p-3 bg-white border rounded shadow-lg w-64">
                    <HexColorPicker
                      color={selectedLayout.styles?.background || "#ffffff"}
                      onChange={(color) =>
                        updateSelected({ styles: { background: color } })
                      }
                      style={{ width: "100%", height: 160 }}
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-slate-500">Hex</span>
                      <HexColorInput
                        className="w-full input"
                        color={selectedLayout.styles?.background || "#ffffff"}
                        onChange={(color) =>
                          updateSelected({ styles: { background: color } })
                        }
                        prefixed
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowBgPicker(false)}
                      className="mt-2 w-full py-1 text-sm bg-slate-100 rounded hover:bg-slate-200"
                    >
                      Fechar
                    </button>
                  </div>
                )}
              </div>

              {/* Text Color */}
              <label className="block text-xs mb-1">Text Color</label>
              <div className="mb-2 relative">
                <button
                  type="button"
                  onClick={() => setShowTextColorPicker((v) => !v)}
                  className="w-full input flex items-center gap-2 justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-5 h-5 rounded-full border"
                      style={{
                        background:
                          selectedLayout.styles?.color || "#000000",
                      }}
                    />
                    <span className="text-sm">
                      {(selectedLayout.styles?.color || "#000000").toUpperCase()}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">
                    clique para escolher
                  </span>
                </button>

                {showTextColorPicker && (
                  <div className="absolute right-0 mt-2 z-50 p-3 bg-white border rounded shadow-lg w-64">
                    <HexColorPicker
                      color={selectedLayout.styles?.color || "#000000"}
                      onChange={(color) =>
                        updateSelected({ styles: { color } })
                      }
                      style={{ width: "100%", height: 160 }}
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-slate-500">Hex</span>
                      <HexColorInput
                        className="w-full input"
                        color={selectedLayout.styles?.color || "#000000"}
                        onChange={(color) =>
                          updateSelected({ styles: { color } })
                        }
                        prefixed
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowTextColorPicker(false)}
                      className="mt-2 w-full py-1 text-sm bg-slate-100 rounded hover:bg-slate-200"
                    >
                      Fechar
                    </button>
                  </div>
                )}
              </div>

              <SizeInput
                label="Padding"
                value={selectedLayout.styles?.padding || ""}
                onChange={(v) => updateSelected({ styles: { padding: v } })}
                units={["px", "rem", "em", "%"]}
              />

              <SizeInput
                label="Font size"
                value={selectedLayout.styles?.fontSize || ""}
                onChange={(v) => updateSelected({ styles: { fontSize: v } })}
                units={["px", "rem", "em", "%", "vw"]}
                placeholder="ex: 16"
              />

              <label className="block text-xs mb-1">Font Family</label>
              <select
                className="w-full mb-2 input"
                value={selectedLayout.styles?.fontFamily || "Arial"}
                onChange={(e) =>
                  updateSelected({ styles: { fontFamily: e.target.value } })
                }
              >
                <option value="Arial">Arial</option>
                <option value="Verdana">Verdana</option>
                <option value="Tahoma">Tahoma</option>
                <option value="'Trebuchet MS'">Trebuchet MS</option>
                <option value="'Times New Roman'">Times New Roman</option>
                <option value="Georgia">Georgia</option>
                <option value="'Courier New'">Courier New</option>
                <option value="'Segoe UI'">Segoe UI</option>
                <option value="system-ui">System UI</option>
              </select>

              <SizeInput
                label="Border radius"
                value={selectedLayout.styles?.borderRadius || ""}
                onChange={(v) =>
                  updateSelected({ styles: { borderRadius: v } })
                }
                units={["px", "%", "rem", "em"]}
              />

              <label className="block text-xs mb-1">Box Shadow</label>
              <select
                className="w-full mb-2 input"
                value={selectedLayout.styles?.boxShadow || ""}
                onChange={(e) =>
                  updateSelected({ styles: { boxShadow: e.target.value } })
                }
              >
                <option value="">Nenhuma</option>
                <option value="0 1px 3px rgba(0,0,0,0.2)">Leve</option>
                <option value="0 4px 10px rgba(0,0,0,0.25)">Média</option>
                <option value="0 10px 25px rgba(0,0,0,0.3)">Forte</option>
              </select>

              {/* Button href */}
              {selectedEl.type === "button" && (
                <>
                  <label className="block text-xs mb-1">
                    Button Link (href)
                  </label>
                  <input
                    className="w-full mb-2 input"
                    placeholder="https://..."
                    value={selectedEl.meta?.href || ""}
                    onChange={(e) =>
                      updateSelected({
                        meta: { href: e.target.value },
                      })
                    }
                  />
                  <label className="block text-xs mb-1">
                    Abrir em nova aba?
                  </label>
                  <select
                    className="w-full mb-2 input"
                    value={selectedEl.meta?.target || ""}
                    onChange={(e) =>
                      updateSelected({
                        meta: { target: e.target.value },
                      })
                    }
                  >
                    <option value="">mesma aba</option>
                    <option value="_blank">nova aba</option>
                  </select>
                </>
              )}

              <div className="flex gap-2 mt-3">
                <button
                  className="px-2 py-1 bg-red-600 text-white rounded"
                  onClick={removeSelected}
                >
                  Remove
                </button>
                {selectedEl.type === "text" && (
                  <button
                    className="px-2 py-1 bg-yellow-500 text-white rounded"
                    onClick={() => {
                      const t = prompt("Edit text:", selectedEl.content);
                      if (t !== null) updateSelected({ content: t });
                    }}
                  >
                    Edit Text
                  </button>
                )}
                {selectedEl.type === "button" && (
                  <button
                    className="px-2 py-1 bg-yellow-500 text-white rounded"
                    onClick={() => {
                      const t = prompt(
                        "Edit button text:",
                        selectedEl.content
                      );
                      if (t !== null) updateSelected({ content: t });
                    }}
                  >
                    Edit Button
                  </button>
                )}
                {selectedEl.type === "image" && (
                  <button
                    className="px-2 py-1 bg-yellow-500 text-white rounded"
                    onClick={() => {
                      const t = prompt(
                        "Image URL:",
                        selectedEl.content || ""
                      );
                      if (t !== null) updateSelected({ content: t });
                    }}
                  >
                    Edit Image URL
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-500 mt-2">
              Nenhum elemento selecionado
            </div>
          )}

          <hr className="my-3" />

          <div className="flex gap-2">
            <button
              className="flex-1 py-2 bg-emerald-600 text-white rounded"
              onClick={onSave}
            >
              Salvar
            </button>
            <button
              className="flex-1 py-2 bg-indigo-700 text-white rounded"
              onClick={exportHTML}
            >
              Exportar
            </button>
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1">
          <div className="mb-2 text-sm text-gray-600">
            Editor — clique fora para desmarcar. Arraste para mover (exceto
            header/footer). Arraste cantos para redimensionar. Grid de {GRID_SIZE}
            px + snap ativo. Use os botões de breakpoint para ver Desktop/Notebook/Tablet/Celular.
          </div>

          <div
            ref={editorRef}
            onMouseDown={() => setSelectedId(null)}
            className="relative bg-white border border-dashed border-slate-200 rounded"
            style={{
              width: "100%",
              maxWidth: `${currentBreakpointConfig.previewWidth}px`,
              margin: "0 auto",
              minHeight: `${pageHeight}px`,
              backgroundImage:
                "linear-gradient(to right, #f3f4f6 1px, transparent 1px), linear-gradient(to bottom, #f3f4f6 1px, transparent 1px)",
              backgroundSize: "20px 20px",
              position: "relative",
              overflowY: "auto",
              overflowX: "hidden",
            }}
          >
            {/* Linhas-guia verticais */}
            {guides.vertical.map((x, idx) => (
              <div
                key={`v-${idx}-${x}`}
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: `${x}px`,
                  width: "1px",
                  background: "#3b82f6",
                  pointerEvents: "none",
                }}
              />
            ))}
            {/* Linhas-guia horizontais */}
            {guides.horizontal.map((y, idx) => (
              <div
                key={`h-${idx}-${y}`}
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: `${y}px`,
                  height: "1px",
                  background: "#3b82f6",
                  pointerEvents: "none",
                }}
              />
            ))}

            {elements.map((el) => renderElement(el))}
          </div>
        </div>
      </div>

      <style>{`
        .editor-element.selected { outline: 2px dashed #2563eb; }
        .input { border: 1px solid #e5e7eb; padding: 6px; border-radius: 6px; }
      `}</style>
    </div>
  );
}
