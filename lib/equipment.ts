export const EQUIPMENT = ["Picomaster", "Ellionix", "Magnetic Annealing"] as const;
export type EquipmentName = (typeof EQUIPMENT)[number];

export function isEquipment(value: unknown): value is EquipmentName {
  return typeof value === "string" && (EQUIPMENT as readonly string[]).includes(value);
}
