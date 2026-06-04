"use client";

import { useState } from "react";
import { Clock } from "lucide-react";
import Button from "@/components/common/Button";
import type { EstimatedHoursData } from "@/interfaces/proposalInterfaces";
import styles from "./EstimateHoursButton.module.scss";

interface EstimateHoursButtonProps {
  estimatedHoursData: EstimatedHoursData | null;
  isEstimating: boolean;
  onOpenModal: () => void;
}

export default function EstimateHoursButton({
  estimatedHoursData,
  isEstimating,
  onOpenModal,
}: EstimateHoursButtonProps): JSX.Element {
  const [isTooltipVisible, setIsTooltipVisible] = useState<boolean>(false);

  const hasData = estimatedHoursData !== null;

  return (
    <div
      className={styles.wrap}
      onMouseEnter={() => hasData && setIsTooltipVisible(true)}
      onMouseLeave={() => setIsTooltipVisible(false)}
      onFocus={() => hasData && setIsTooltipVisible(true)}
      onBlur={() => setIsTooltipVisible(false)}
    >
      <Button
        variant="secondary"
        size="sm"
        loading={isEstimating}
        disabled={isEstimating}
        onClick={onOpenModal}
        className={styles.btn}
      >
        <Clock size={14} />
        <span>Estimate Hours</span>
        {hasData && !isEstimating && <span className={styles.dot} aria-hidden="true" />}
      </Button>

      {hasData && (
        <div
          className={`${styles.tooltip} ${isTooltipVisible ? styles.tooltipVisible : ""}`}
          role="tooltip"
          aria-hidden={!isTooltipVisible}
        >
          <div className={styles.totalRow}>
            {estimatedHoursData.totalEstimatedHours.hours}h total
          </div>
          <p className={styles.totalDesc}>{estimatedHoursData.totalEstimatedHours.description}</p>
          <div className={styles.divider} aria-hidden="true" />
          <div className={styles.grid}>
            {estimatedHoursData.teamBreakdown.map((entry) => (
              <div key={entry.role} className={styles.gridRow}>
                <span className={styles.role}>{entry.role}</span>
                <span className={styles.hours}>{entry.hours}h</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
