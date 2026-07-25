"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { LifeMapLocation, LifeArea, Organization, Goal, Document, Transaction } from "@/lib/types";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Segmented } from "@/components/dashboard/ui";
import { OverviewModule, type OverviewData } from "@/components/dashboard/modules/OverviewModule";
import { LifeMapModule } from "@/components/dashboard/modules/LifeMapModule";
import { CommandCenter } from "@/components/dashboard/CommandCenter";
import { JarvisBriefing } from "@/components/jarvis/JarvisBriefing";

type Tab = "command" | "map" | "stats";

type Props = {
  overview: OverviewData;
  mapLocations: LifeMapLocation[];
  mapLifeAreas: LifeArea[];
  mapOrganizations: Organization[];
  mapGoals: Goal[];
  mapDocuments: Document[];
  mapTransactions: Transaction[];
};

/** The LifeOS home screen — entered right after the landing globe. The
 * Hungary map is the default view, with every sidebar module reachable as a
 * clickable pin orbiting the country; "Stats" is a toggle to the old
 * Mission Control dashboard, not a separate page. */
export function HomeModule({ overview, mapLocations, mapLifeAreas, mapOrganizations, mapGoals, mapDocuments, mapTransactions }: Props) {
  const { t } = useLocale();
  const [tab, setTab] = useState<Tab>("command");

  return (
    <div>
      {/* Jarvis speaks first, at the top of the home screen — the one place the
          user reliably lands. Renders nothing when there is nothing worth
          saying, which is most of the time. */}
      <JarvisBriefing />

      <div className="mb-5 flex items-center justify-end">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "command", label: t("home.tabCommand") },
            { value: "map", label: t("home.tabMap") },
            { value: "stats", label: t("home.tabStats") },
          ]}
        />
      </div>

      <AnimatePresence mode="wait">
        {tab === "command" ? (
          <motion.div key="command" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
            <CommandCenter data={overview} />
          </motion.div>
        ) : tab === "map" ? (
          <motion.div key="map" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
            <LifeMapModule
              locations={mapLocations}
              lifeAreas={mapLifeAreas}
              organizations={mapOrganizations}
              goals={mapGoals}
              documents={mapDocuments}
              transactions={mapTransactions}
              showNavPins
              compact
            />
          </motion.div>
        ) : (
          <motion.div key="stats" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
            <OverviewModule data={overview} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
