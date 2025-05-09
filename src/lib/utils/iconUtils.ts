import { get } from 'svelte/store';
import { iconStore, loadIcons, } from '$lib/stores/iconStore';

/**
 * Creates a card icon SVG element with paths based on icon name
 * This is a direct implementation that avoids using Svelte components, 
 * which is compatible with Svelte 5.25.9 in RUNES mode
 */
export function createCardIcon(
  iconName: string | undefined,
  iconSize: number,
  container: HTMLElement,
  cardTitle: string
): void {
  const requestedIcon = iconName || 'user';

  try {
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", iconSize.toString());
    svg.setAttribute("height", iconSize.toString());
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("stroke", "#555555");
    svg.setAttribute("stroke-width", "1.5");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("fill", "none");
    svg.setAttribute("class", "lucide-icon");

    const createUserIcon = () => {
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", "12");
      circle.setAttribute("cy", "8");
      circle.setAttribute("r", "4");
      svg.appendChild(circle);

      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", "M20 20v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2");
      svg.appendChild(path);
    };

    const createSunIcon = () => {
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", "12");
      circle.setAttribute("cy", "12");
      circle.setAttribute("r", "4");
      svg.appendChild(circle);

      const line1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line1.setAttribute("x1", "12");
      line1.setAttribute("y1", "2");
      line1.setAttribute("x2", "12");
      line1.setAttribute("y2", "4");
      svg.appendChild(line1);

      const line2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line2.setAttribute("x1", "12");
      line2.setAttribute("y1", "20");
      line2.setAttribute("x2", "12");
      line2.setAttribute("y2", "22");
      svg.appendChild(line2);

      const line3 = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line3.setAttribute("x1", "5");
      line3.setAttribute("y1", "5");
      line3.setAttribute("x2", "7");
      line3.setAttribute("y2", "7");
      svg.appendChild(line3);

      const line4 = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line4.setAttribute("x1", "17");
      line4.setAttribute("y1", "17");
      line4.setAttribute("x2", "19");
      line4.setAttribute("y2", "19");
      svg.appendChild(line4);

      const line5 = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line5.setAttribute("x1", "2");
      line5.setAttribute("y1", "12");
      line5.setAttribute("x2", "4");
      line5.setAttribute("y2", "12");
      svg.appendChild(line5);

      const line6 = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line6.setAttribute("x1", "20");
      line6.setAttribute("y1", "12");
      line6.setAttribute("x2", "22");
      line6.setAttribute("y2", "12");
      svg.appendChild(line6);

      const line7 = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line7.setAttribute("x1", "5");
      line7.setAttribute("y1", "19");
      line7.setAttribute("x2", "7");
      line7.setAttribute("y2", "17");
      svg.appendChild(line7);

      const line8 = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line8.setAttribute("x1", "17");
      line8.setAttribute("y1", "7");
      line8.setAttribute("x2", "19");
      line8.setAttribute("y2", "5");
      svg.appendChild(line8);
    };

    const createLinkIcon = () => {
      const path1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path1.setAttribute("d", "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71");
      svg.appendChild(path1);

      const path2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path2.setAttribute("d", "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71");
      svg.appendChild(path2);
    };

    const createMoneyIcon = () => {
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", "12");
      circle.setAttribute("cy", "12");
      circle.setAttribute("r", "10");
      svg.appendChild(circle);

      const line1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line1.setAttribute("x1", "12");
      line1.setAttribute("y1", "6");
      line1.setAttribute("x2", "12");
      line1.setAttribute("y2", "18");
      svg.appendChild(line1);

      const line2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line2.setAttribute("x1", "8");
      line2.setAttribute("y1", "12");
      line2.setAttribute("x2", "16");
      line2.setAttribute("y2", "12");
      svg.appendChild(line2);
    };

    switch(requestedIcon.toLowerCase()) {
      case 'sun': createSunIcon(); break;
      case 'link': createLinkIcon(); break;
      case 'dollarsign':
      case 'dollar':
      case 'circledollarsign':
      case 'money':
      case 'coins': createMoneyIcon(); break;
      case 'user':
      case 'person': createUserIcon(); break;
      default:
        console.log('Using default user icon for:', requestedIcon);
        createUserIcon();
        break;
    }

    container.appendChild(svg);
  } catch (err) {
    console.error('Error creating card icon:', err);
    try {
      const fallbackSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      fallbackSvg.setAttribute("width", iconSize.toString());
      fallbackSvg.setAttribute("height", iconSize.toString());
      fallbackSvg.setAttribute("viewBox", "0 0 24 24");
      fallbackSvg.setAttribute("stroke", "#555555");
      fallbackSvg.setAttribute("fill", "none");
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", "12");
      circle.setAttribute("cy", "12");
      circle.setAttribute("r", "10");
      fallbackSvg.appendChild(circle);
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", "12");
      line.setAttribute("y1", "8");
      line.setAttribute("x2", "12");
      line.setAttribute("y2", "16");
      fallbackSvg.appendChild(line);
      const line2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line2.setAttribute("x1", "8");
      line2.setAttribute("y1", "12");
      line2.setAttribute("x2", "16");
      line2.setAttribute("y2", "12");
      fallbackSvg.appendChild(line2);
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
      container.appendChild(fallbackSvg);
    } catch (fallbackErr) {
      console.error('Unable to create fallback icon:', fallbackErr);
    }
  }
}