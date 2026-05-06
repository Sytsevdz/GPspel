import Image from "next/image";

import { getTeamSideImageSize } from "@/lib/team-side-view-images";

type DriverScoreRow = {
  label: string;
  value: string | number;
};

type DriverScoreCardProps = {
  teamImage: string;
  teamName: string;
  driverName: string;
  constructorTeam: string;
  rows: DriverScoreRow[];
  className?: string;
};

export function DriverScoreCard({
  teamImage,
  teamName,
  driverName,
  constructorTeam,
  rows,
  className,
}: DriverScoreCardProps) {
  const imageSize = getTeamSideImageSize("selectedCard");

  return (
    <li className={["driver-score-card", className].filter(Boolean).join(" ")}>
      <div className="driver-score-card-image-wrap">
        <Image
          src={teamImage}
          alt={`${teamName} wagen`}
          width={imageSize.width}
          height={imageSize.height}
          className={imageSize.className}
        />
      </div>

      <div className="driver-score-card-copy">
        <p className="driver-score-card-name">
          <strong>{driverName}</strong>
          <span>{constructorTeam}</span>
        </p>
        <dl className="driver-score-card-points">
          {rows.map((row) => (
            <div key={`${driverName}-${row.label}`}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </li>
  );
}
