"use client";

import { CatchupSegmentVisual } from "@/components/catchup/catchup-segment-visual";
import { inputClass, labelClass, secondaryButtonClass } from "./ui";
import {
  defaultTeachingVisualConfig,
  normalizeTeachingVisualConfig,
} from "@/lib/catchup/teaching-visuals/defaults";
import { VISUAL_ACCENT_COLORS } from "@/lib/catchup/teaching-visuals/colors";
import {
  TEACHING_VISUAL_TYPE_LABELS,
  TEACHING_VISUAL_TYPES,
  type TeachingVisualType,
} from "@/lib/catchup/teaching-visuals/types";
import { useMemo, useState } from "react";

type TeachingVisualEditorProps = {
  initialType: string | null;
  initialConfig: unknown;
};

export function CatchupTeachingVisualEditor({
  initialType,
  initialConfig,
}: TeachingVisualEditorProps) {
  const startingType = TEACHING_VISUAL_TYPES.includes(initialType as TeachingVisualType)
    ? (initialType as TeachingVisualType)
    : "icon_hero";

  const [visualType, setVisualType] = useState<TeachingVisualType>(startingType);
  const [config, setConfig] = useState(() =>
    normalizeTeachingVisualConfig(startingType, initialConfig)
  );

  const visual = useMemo(
    () => ({ type: visualType, config }),
    [visualType, config]
  );

  function changeType(nextType: TeachingVisualType) {
    setVisualType(nextType);
    setConfig(defaultTeachingVisualConfig(nextType));
  }

  return (
    <div className="space-y-4 rounded-xl border border-violet-200 bg-violet-50/30 p-4">
      <div>
        <label className={labelClass}>Teaching visual template</label>
        <select
          value={visualType}
          onChange={(event) => changeType(event.target.value as TeachingVisualType)}
          className={inputClass}
        >
          {TEACHING_VISUAL_TYPES.map((type) => (
            <option key={type} value={type}>
              {TEACHING_VISUAL_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-zinc-500">
          Lucide icon names (PascalCase), e.g. Sparkles, User, Brain.
        </p>
      </div>

      <input type="hidden" name="teaching_visual_type" value={visualType} />
      <input
        type="hidden"
        name="teaching_visual_config"
        value={JSON.stringify(config)}
      />

      {visualType === "icon_hero" ? (
        <IconHeroFields
          config={config as import("@/lib/catchup/teaching-visuals/types").IconHeroConfig}
          onChange={setConfig}
        />
      ) : null}

      {visualType === "zone_diagram" ? (
        <ZoneDiagramFields
          config={config as import("@/lib/catchup/teaching-visuals/types").ZoneDiagramConfig}
          onChange={setConfig}
        />
      ) : null}

      {visualType === "phrase_showcase" ? (
        <PhraseShowcaseFields
          config={config as import("@/lib/catchup/teaching-visuals/types").PhraseShowcaseConfig}
          onChange={setConfig}
        />
      ) : null}

      {visualType === "activity_scene" ? (
        <ActivitySceneFields
          config={config as import("@/lib/catchup/teaching-visuals/types").ActivitySceneConfig}
          onChange={setConfig}
        />
      ) : null}

      {visualType === "recap_banner" ? (
        <RecapBannerFields
          config={config as import("@/lib/catchup/teaching-visuals/types").RecapBannerConfig}
          onChange={setConfig}
        />
      ) : null}

      {visualType === "quiz_banner" ? (
        <QuizBannerFields
          config={config as import("@/lib/catchup/teaching-visuals/types").QuizBannerConfig}
          onChange={setConfig}
        />
      ) : null}

      <div>
        <p className={labelClass}>Preview</p>
        <CatchupSegmentVisual visual={visual} />
      </div>
    </div>
  );
}

function IconHeroFields({
  config,
  onChange,
}: {
  config: import("@/lib/catchup/teaching-visuals/types").IconHeroConfig;
  onChange: (config: import("@/lib/catchup/teaching-visuals/types").TeachingVisualConfig) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className={labelClass}>Icons (comma-separated)</label>
        <input
          value={config.icons.join(", ")}
          onChange={(event) =>
            onChange({
              ...config,
              icons: event.target.value
                .split(",")
                .map((value) => value.trim())
                .filter(Boolean),
            })
          }
          className={inputClass}
          placeholder="Sparkles, Mic"
        />
      </div>
      <div>
        <label className={labelClass}>Label</label>
        <input
          value={config.label}
          onChange={(event) => onChange({ ...config, label: event.target.value })}
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>Accent color</label>
        <select
          value={config.accentColor}
          onChange={(event) =>
            onChange({
              ...config,
              accentColor: event.target.value as typeof config.accentColor,
            })
          }
          className={inputClass}
        >
          {VISUAL_ACCENT_COLORS.map((color) => (
            <option key={color} value={color}>
              {color}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function ZoneDiagramFields({
  config,
  onChange,
}: {
  config: import("@/lib/catchup/teaching-visuals/types").ZoneDiagramConfig;
  onChange: (config: import("@/lib/catchup/teaching-visuals/types").TeachingVisualConfig) => void;
}) {
  function updateZone(
    index: number,
    patch: Partial<import("@/lib/catchup/teaching-visuals/types").ZoneDiagramConfig["zones"][number]>
  ) {
    const zones = config.zones.map((zone, zoneIndex) =>
      zoneIndex === index ? { ...zone, ...patch } : zone
    );
    onChange({ zones });
  }

  return (
    <div className="space-y-4">
      {config.zones.map((zone, index) => (
        <div key={index} className="rounded-lg border border-zinc-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Zone {index + 1}
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <input
              value={zone.icon}
              onChange={(event) => updateZone(index, { icon: event.target.value })}
              placeholder="Icon"
              className={inputClass}
            />
            <select
              value={zone.color}
              onChange={(event) =>
                updateZone(index, {
                  color: event.target.value as typeof zone.color,
                })
              }
              className={inputClass}
            >
              {VISUAL_ACCENT_COLORS.map((color) => (
                <option key={color} value={color}>
                  {color}
                </option>
              ))}
            </select>
            <input
              value={zone.label}
              onChange={(event) => updateZone(index, { label: event.target.value })}
              placeholder="Label"
              className={inputClass}
            />
            <input
              value={zone.sublabel}
              onChange={(event) => updateZone(index, { sublabel: event.target.value })}
              placeholder="Sublabel"
              className={inputClass}
            />
          </div>
        </div>
      ))}
      <button
        type="button"
        className={secondaryButtonClass}
        onClick={() =>
          onChange({
            zones: [
              ...config.zones,
              { icon: "Circle", label: "New zone", sublabel: "Description", color: "gray" },
            ],
          })
        }
      >
        Add zone
      </button>
    </div>
  );
}

function PhraseShowcaseFields({
  config,
  onChange,
}: {
  config: import("@/lib/catchup/teaching-visuals/types").PhraseShowcaseConfig;
  onChange: (config: import("@/lib/catchup/teaching-visuals/types").TeachingVisualConfig) => void;
}) {
  function updateItem(index: number, patch: Partial<{ icon: string; label: string }>) {
    const items = config.items.map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...patch } : item
    );
    onChange({ items });
  }

  return (
    <div className="space-y-3">
      {config.items.map((item, index) => (
        <div key={index} className="grid gap-2 sm:grid-cols-2">
          <input
            value={item.icon}
            onChange={(event) => updateItem(index, { icon: event.target.value })}
            placeholder="Icon"
            className={inputClass}
          />
          <input
            value={item.label}
            onChange={(event) => updateItem(index, { label: event.target.value })}
            placeholder="Label"
            className={inputClass}
          />
        </div>
      ))}
      <button
        type="button"
        className={secondaryButtonClass}
        onClick={() => onChange({ items: [...config.items, { icon: "Circle", label: "Phrase" }] })}
      >
        Add phrase
      </button>
    </div>
  );
}

function ActivitySceneFields({
  config,
  onChange,
}: {
  config: import("@/lib/catchup/teaching-visuals/types").ActivitySceneConfig;
  onChange: (config: import("@/lib/catchup/teaching-visuals/types").TeachingVisualConfig) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className={labelClass}>Icons (comma-separated)</label>
        <input
          value={config.icons.join(", ")}
          onChange={(event) =>
            onChange({
              ...config,
              icons: event.target.value
                .split(",")
                .map((value) => value.trim())
                .filter(Boolean),
            })
          }
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>Caption</label>
        <input
          value={config.caption}
          onChange={(event) => onChange({ ...config, caption: event.target.value })}
          className={inputClass}
        />
      </div>
    </div>
  );
}

function RecapBannerFields({
  config,
  onChange,
}: {
  config: import("@/lib/catchup/teaching-visuals/types").RecapBannerConfig;
  onChange: (config: import("@/lib/catchup/teaching-visuals/types").TeachingVisualConfig) => void;
}) {
  return (
    <div className="space-y-3">
      <input
        value={config.icon}
        onChange={(event) => onChange({ ...config, icon: event.target.value })}
        placeholder="Icon"
        className={inputClass}
      />
      <input
        value={config.heading}
        onChange={(event) => onChange({ ...config, heading: event.target.value })}
        placeholder="Heading"
        className={inputClass}
      />
      <input
        value={config.subheading}
        onChange={(event) => onChange({ ...config, subheading: event.target.value })}
        placeholder="Subheading"
        className={inputClass}
      />
    </div>
  );
}

function QuizBannerFields({
  config,
  onChange,
}: {
  config: import("@/lib/catchup/teaching-visuals/types").QuizBannerConfig;
  onChange: (config: import("@/lib/catchup/teaching-visuals/types").TeachingVisualConfig) => void;
}) {
  return (
    <div className="space-y-3">
      <input
        value={config.icon}
        onChange={(event) => onChange({ ...config, icon: event.target.value })}
        placeholder="Icon"
        className={inputClass}
      />
      <input
        value={config.heading}
        onChange={(event) => onChange({ ...config, heading: event.target.value })}
        placeholder="Heading"
        className={inputClass}
      />
    </div>
  );
}
