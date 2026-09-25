export function cleanName(name: string) {
  return name.replace(/\s+/g, " ").trim();
}

export function playerKey(name: string) {
  return cleanName(name)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

export function listsLabel(count: number) {
  return count === 1 ? "1 lista" : `${count} listas`;
}
