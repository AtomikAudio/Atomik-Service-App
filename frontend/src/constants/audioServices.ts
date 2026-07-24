/** UI categories mapped to API serviceType */
export type ApiServiceType = 'general' | 'inspection' | 'installation' | 'emergency';

export interface AudioServiceItem {
  id: string;
  label: string;
  icon: string;
  apiType: ApiServiceType;
  duration: string;
  basePrice: string;
  description: string;
  parentId?: string;
}

export interface ServiceGroup {
  id: string;
  label: string;
  icon: string;
  description: string;
  hasSubmenu: boolean;
  apiType: ApiServiceType;
}

/** Top-level: General Service · General Visit */
export const SERVICE_GROUPS: ServiceGroup[] = [
  {
    id: 'general-service',
    label: 'General Service',
    icon: 'hardware-chip-outline',
    description:
      'Full system service — tuning, amp rack rebuild, and damage inspection',
    hasSubmenu: true,
    apiType: 'general',
  },
  {
    id: 'general-visit',
    label: 'General Visit',
    icon: 'navigate-outline',
    description:
      'On-site audio assessment, diagnostics, and recommendations',
    hasSubmenu: true,
    apiType: 'inspection',
  },
];

/** Sub-services under General Service */
export const GENERAL_SERVICE_ITEMS: AudioServiceItem[] = [
  {
    id: 'amplifier',
    label: 'Amplifier Service',
    icon: 'radio-outline',
    apiType: 'general',
    duration: '2–3 hrs',
    basePrice: '₹5,500',
    description: 'Power amp diagnostics, gain staging & protection',
    parentId: 'general-service',
  },
  {
    id: 'speaker',
    label: 'Speaker Service',
    icon: 'volume-high-outline',
    apiType: 'general',
    duration: '2–4 hrs',
    basePrice: '₹6,000',
    description: 'Driver check, crossover & cabinet inspection',
    parentId: 'general-service',
  },
  {
    id: 'sound-card',
    label: 'Sound Card',
    icon: 'card-outline',
    apiType: 'general',
    duration: '1–2 hrs',
    basePrice: '₹3,500',
    description: 'Interface setup, latency & I/O verification',
    parentId: 'general-service',
  },
  {
    id: 'media-player',
    label: 'Media Player',
    icon: 'play-circle-outline',
    apiType: 'general',
    duration: '1–2 hrs',
    basePrice: '₹3,000',
    description: 'Playback systems, routing & format support',
    parentId: 'general-service',
  },
  {
    id: 'dsp',
    label: 'DSP Service',
    icon: 'pulse-outline',
    apiType: 'general',
    duration: '3–5 hrs',
    basePrice: '₹7,500',
    description: 'EQ, delay, matrix & signal chain optimization',
    parentId: 'general-service',
  },
  {
    id: 'others',
    label: 'Others',
    icon: 'ellipsis-horizontal-outline',
    apiType: 'general',
    duration: 'Varies',
    basePrice: 'Quote',
    description: 'Custom work or equipment not listed above',
    parentId: 'general-service',
  },
];

/** Fixed General Service package (no per-item selection). */
export const GENERAL_SERVICE_PACKAGE: AudioServiceItem = {
  id: 'general-service',
  label: 'General Service',
  icon: 'hardware-chip-outline',
  apiType: 'general',
  duration: '4–6 hrs',
  basePrice: '₹15,000',
  description: 'Complete sound system service package',
};

/** What the General Service package includes (display-only, not selectable). */
export const GENERAL_SERVICE_INCLUSIONS: {
  id: string;
  label: string;
  description: string;
  icon: string;
}[] = [
  {
    id: 'tuning',
    label: 'Tuning & Alignment of the Sound System',
    description:
      'Gain structure, EQ balance, and speaker alignment for clear, even coverage.',
    icon: 'options-outline',
  },
  {
    id: 'amp-rack',
    label: 'Reassembly of the Amplifier Rack',
    description:
      'Clean rack rebuild, cable dress, and power sequencing for reliable operation.',
    icon: 'construct-outline',
  },
  {
    id: 'damage-check',
    label: 'Inspection for Any Damage',
    description:
      'Drivers, connectors, and protection circuits checked before you go live.',
    icon: 'shield-checkmark-outline',
  },
];

/** Fixed subtotal shown on the General Service screen (pre-GST). */
export const GENERAL_SERVICE_PRICE = '₹15,000';

/** Fixed General Visit price (pre-GST) — matches backend inspection pricing. */
export const GENERAL_VISIT_PRICE = '₹3,500';

/** What the General Visit package includes (display-only, not selectable). */
export const GENERAL_VISIT_INCLUSIONS: {
  id: string;
  label: string;
  description: string;
  icon: string;
}[] = [
  {
    id: 'site-assessment',
    label: 'On-site System Assessment',
    description:
      'Walkthrough of your audio setup, room layout, and current performance.',
    icon: 'walk-outline',
  },
  {
    id: 'diagnostics',
    label: 'Diagnostics & Fault Checks',
    description:
      'Signal path, amp, and speaker checks to identify issues before service.',
    icon: 'pulse-outline',
  },
  {
    id: 'recommendations',
    label: 'Recommendations & Next Steps',
    description:
      'Clear guidance on repairs, upgrades, or a full General Service if needed.',
    icon: 'clipboard-outline',
  },
];

/** @deprecated Not shown on Categories screen — select via General Service → Others */
export const OTHERS_SERVICE_GROUP: ServiceGroup = {
  id: 'others',
  label: 'Others',
  icon: 'ellipsis-horizontal-outline',
  description: 'Custom or unlisted service requirements',
  hasSubmenu: false,
  apiType: 'general',
};

export const GENERAL_VISIT_ITEM: AudioServiceItem = {
  id: 'general-visit',
  label: 'General Visit',
  icon: 'navigate-outline',
  apiType: 'inspection',
  duration: '1–2 hrs',
  basePrice: '₹3,500',
  description: 'On-site assessment & diagnostic visit',
};

export const ALL_SERVICE_ITEMS: AudioServiceItem[] = [
  GENERAL_SERVICE_PACKAGE,
  ...GENERAL_SERVICE_ITEMS,
  GENERAL_VISIT_ITEM,
];

/** Shown below service lists — extra parts billing policy */
export const EXTRA_PARTS_CHARGE_NOTE =
  'Extra parts and materials used during service are chargeable separately and will be added to your invoice after the visit.';

export const getServiceById = (id: string): AudioServiceItem | undefined =>
  ALL_SERVICE_ITEMS.find((s) => s.id === id);

export const getGroupById = (id: string): ServiceGroup | undefined =>
  SERVICE_GROUPS.find((g) => g.id === id);

/** @deprecated use getServiceById */
export const getCategoryById = getServiceById;

export const resolvePrimaryServiceType = (
  categoryIds: string[]
): ApiServiceType => {
  const types = categoryIds
    .map((id) => getServiceById(id)?.apiType)
    .filter(Boolean) as ApiServiceType[];
  if (types.includes('emergency')) return 'emergency';
  if (types.includes('installation')) return 'installation';
  if (types.includes('inspection')) return 'inspection';
  return 'general';
};
