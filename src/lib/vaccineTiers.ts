/**
 * @file lib/vaccineTiers.ts
 * @description Official WHO/CDC Cold-Chain Vaccine Classification Tiers,
 *              temperature bounds, descriptions, and recommended transport equipment.
 */

export type VaccineTierType = "STANDARD_REFRIGERATED" | "FROZEN" | "ULTRA_COLD";

export interface VaccineTierConfig {
  id: VaccineTierType;
  name: string;
  badge: string;
  tempRangeLabel: string;
  minTemp: number; // [°C]
  maxTemp: number; // [°C]
  targetTemp: number; // [°C]
  freezeLimit?: number; // [°C]
  description: string;
  examples: string[];
  equipmentOptions: string[];
  themeColor: string;
  accentBorder: string;
  accentBg: string;
}

export const VACCINE_TIERS: Record<VaccineTierType, VaccineTierConfig> = {
  STANDARD_REFRIGERATED: {
    id: "STANDARD_REFRIGERATED",
    name: "Standard Refrigerated Vaccines",
    badge: "+2°C to +8°C",
    tempRangeLabel: "+2°C to +8°C (35°F to 46°F)",
    minTemp: 2.0,
    maxTemp: 8.0,
    targetTemp: 4.0,
    freezeLimit: 0.0,
    description:
      "Most common tier in global immunization. Must stay cold but NEVER freeze — a single exposure to freezing (≤0°C) can permanently denature the adjuvant and destroy effectiveness.",
    examples: [
      "DPT / Pentavalent",
      "Tetanus Toxoid (TT)",
      "Hepatitis B",
      "Inactivated Polio (IPV)",
      "Pneumococcal Conjugate (PCV)",
      "Hib Conjugate",
      "Influenza & Hepatitis A",
    ],
    equipmentOptions: [
      "Ice-lined refrigerator (ILR) van",
      "Refrigerated Reefer Truck",
      "Passive cold box with conditioned ice packs",
      "WHO-prequalified vaccine carrier",
    ],
    themeColor: "text-cyan-400",
    accentBorder: "border-cyan-500/40 hover:border-cyan-400",
    accentBg: "bg-cyan-950/30",
  },
  FROZEN: {
    id: "FROZEN",
    name: "Frozen Sub-Zero Vaccines",
    badge: "-25°C to -15°C",
    tempRangeLabel: "-25°C to -15°C (down to -50°C)",
    minTemp: -25.0,
    maxTemp: -15.0,
    targetTemp: -20.0,
    freezeLimit: undefined,
    description:
      "Live-attenuated and specialized viral vaccines that degrade rapidly if allowed to thaw above -15°C. Requires continuous sub-zero deep freeze during transit.",
    examples: [
      "Oral Polio Vaccine (OPV)",
      "Varicella (Chickenpox)",
      "Zoster (Shingles)",
      "Yellow Fever (deep freeze)",
    ],
    equipmentOptions: [
      "Deep freezer transport vehicle (-20°C)",
      "Specialized frozen insulated shipper",
      "Dry-ice / Sub-zero phase change gel packs",
    ],
    themeColor: "text-blue-400",
    accentBorder: "border-blue-500/40 hover:border-blue-400",
    accentBg: "bg-blue-950/30",
  },
  ULTRA_COLD: {
    id: "ULTRA_COLD",
    name: "Ultra-Cold Chain (ULT) Vaccines",
    badge: "-80°C to -60°C",
    tempRangeLabel: "-80°C to -60°C (-112°F to -76°F)",
    minTemp: -80.0,
    maxTemp: -60.0,
    targetTemp: -70.0,
    freezeLimit: undefined,
    description:
      "Fragile genetic platforms (e.g. mRNA vaccines) requiring extreme sub-zero cryogenic environments to maintain lipid nanoparticle integrity and prevent rapid molecular degradation.",
    examples: [
      "Pfizer-BioNTech Comirnaty mRNA",
      "Moderna Spikevax (long term ULT storage)",
      "Viral vector & recombinant clinical trial platforms",
    ],
    equipmentOptions: [
      "Specialized thermal shipper with dry ice (UN1845)",
      "Ultra-low temperature (ULT) mobile freezer (-86°C)",
      "Stirling ultracold portable freezer",
    ],
    themeColor: "text-purple-400",
    accentBorder: "border-purple-500/40 hover:border-purple-400",
    accentBg: "bg-purple-950/30",
  },
};

/** Quick helper to get tier configuration by tier ID */
export function getVaccineTierConfig(tier: VaccineTierType | string): VaccineTierConfig {
  if (tier in VACCINE_TIERS) {
    return VACCINE_TIERS[tier as VaccineTierType];
  }
  return VACCINE_TIERS.STANDARD_REFRIGERATED;
}
