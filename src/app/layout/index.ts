/**
 * Layout barrel — only the symbols other modules actually import.
 *
 * Per-component `*Props` types are deliberately NOT re-exported: they are
 * only used inside the layout module, and re-exporting them via the barrel
 * encourages cross-module coupling that the rules forbid. If you need a
 * Props type elsewhere, import it directly from the component file.
 */

export { Layout } from './Layout';
export { Header } from './Header';
export { Footer } from './Footer';
export { Menu } from './Menu';
export { Sidebar } from './Sidebar';
export { Screen } from './Screen';
export { Popup } from './Popup';
export { Overlay } from './Overlay';
export { PageHeaderProvider, PageTitle, usePageHeader } from './PageHeader';
