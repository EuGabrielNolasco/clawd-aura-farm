// Catálogo de enfeites (pagos com Fichas 67). O servidor espelha só código, slot e preço
// (supabase/schema.sql); o desenho fica aqui. Cada desenho é SVG no mesmo grid 32×32 do Clawd.

export type Slot = "bg" | "hat" | "face" | "outfit" | "color";

export const SLOTS: readonly { id: Slot; code: string; name: string }[] = [
  { id: "bg", code: "B", name: "Fundo" },
  { id: "hat", code: "H", name: "Chapéu" },
  { id: "face", code: "F", name: "Rosto" },
  { id: "outfit", code: "O", name: "Roupa" },
  { id: "color", code: "C", name: "Cor" },
];

export interface Cosmetic {
  id: string;
  /** Caractere usado no protocolo de eventos. */
  code: string;
  slot: Slot;
  name: string;
  price: number;
  /** SVG desenhado por cima do Clawd (chapéu, rosto, roupa). */
  svg?: string;
  /** Cor do corpo (slot "color"). */
  fill?: string;
  /** Classe aplicada ao palco (slot "bg"). */
  bgClass?: string;
}

const px = (x: number, y: number, w: number, h: number, fill: string) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;

export const COSMETICS: readonly Cosmetic[] = [
  // fundos
  { id: "bg_favela", code: "A", slot: "bg", name: "Favela neon", price: 40, bgClass: "bg-favela" },
  { id: "bg_praia", code: "B", slot: "bg", name: "Praia de Copacabana", price: 40, bgClass: "bg-praia" },
  { id: "bg_server", code: "C", slot: "bg", name: "Sala de servidores", price: 60, bgClass: "bg-server" },
  { id: "bg_espaco", code: "D", slot: "bg", name: "Espaço sideral", price: 90, bgClass: "bg-espaco" },
  // chapéus
  { id: "hat_bone", code: "E", slot: "hat", name: "Boné aba reta", price: 20,
    svg: px(9, 6, 14, 3, "#1d4ed8") + px(17, 8, 9, 1, "#1d4ed8") + px(14, 6, 4, 1, "#ffd166") },
  { id: "hat_coroa", code: "F", slot: "hat", name: "Coroa de ouro", price: 80,
    svg: px(11, 6, 10, 3, "#ffd166") + px(11, 4, 2, 2, "#ffd166") + px(15, 3, 2, 3, "#ffd166") + px(19, 4, 2, 2, "#ffd166") + px(15, 7, 2, 1, "#ff6b6b") },
  { id: "hat_megabrain", code: "G", slot: "hat", name: "Capacete Mega Brain", price: 120,
    svg: px(9, 4, 14, 5, "#94a3b8") + px(10, 3, 12, 1, "#cbd5e1") + px(11, 5, 10, 2, "#ff8fb8") + px(13, 5, 1, 1, "#6bffe0") + px(18, 6, 1, 1, "#6bffe0") + px(15, 2, 2, 1, "#6bffe0") },
  // rosto
  { id: "face_juliet", code: "H", slot: "face", name: "Óculos Juliet", price: 30,
    svg: px(9, 12, 6, 3, "#f97316") + px(17, 12, 6, 3, "#3b82f6") + px(15, 12, 2, 1, "#e5e7eb") + px(8, 12, 1, 1, "#e5e7eb") + px(23, 12, 1, 1, "#e5e7eb") },
  { id: "face_3d", code: "I", slot: "face", name: "Óculos 3D", price: 25,
    svg: px(9, 12, 6, 3, "#ef4444") + px(17, 12, 6, 3, "#06b6d4") + px(15, 12, 2, 1, "#f3ecff") },
  { id: "face_bigode", code: "J", slot: "face", name: "Bigodão", price: 15,
    svg: px(12, 16, 8, 1, "#3b2416") + px(11, 17, 2, 1, "#3b2416") + px(19, 17, 2, 1, "#3b2416") },
  // roupas
  { id: "outfit_selecao", code: "K", slot: "outfit", name: "Camisa da seleção", price: 50,
    svg: px(8, 17, 16, 4, "#facc15") + px(8, 17, 16, 1, "#16a34a") + px(15, 18, 2, 2, "#1d4ed8") },
  { id: "outfit_capa", code: "L", slot: "outfit", name: "Capa de herói", price: 70,
    svg: px(6, 10, 2, 11, "#dc2626") + px(24, 10, 2, 11, "#dc2626") + px(8, 10, 16, 1, "#dc2626") },
  { id: "outfit_terno", code: "M", slot: "outfit", name: "Terno sigma", price: 100,
    svg: px(8, 16, 16, 5, "#111827") + px(15, 16, 2, 5, "#f3ecff") + px(15, 17, 2, 3, "#dc2626") },
  // cores
  { id: "color_dourado", code: "N", slot: "color", name: "Dourado", price: 60, fill: "#ffd166" },
  { id: "color_neon", code: "P", slot: "color", name: "Neon", price: 45, fill: "#39ff88" },
  { id: "color_camuflado", code: "Q", slot: "color", name: "Camuflado", price: 35, fill: "#5b7a3a" },
];

export const cosmeticByCode = (code: string) => COSMETICS.find(c => c.code === code);
export const cosmeticById = (id: string) => COSMETICS.find(c => c.id === id);
export const slotByCode = (code: string) => SLOTS.find(s => s.code === code)?.id;
