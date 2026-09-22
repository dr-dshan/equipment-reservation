export const EQUIPMENT = ["Picomaster", "Ellionix", "Magnetic Annealing", "AJA Oxide Sputter", "Magnetotransport system (L6315)", "Magnetotransport system (T4105)"] as const;
export type EquipmentName = (typeof EQUIPMENT)[number];

export function isEquipment(value: unknown): value is EquipmentName {
  return typeof value === "string" && (EQUIPMENT as readonly string[]).includes(value);
}
