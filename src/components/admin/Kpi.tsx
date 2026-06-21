import { Icon } from "@/components/Icon";

export function Kpi({ label, value, icon }: { label: string; value: React.ReactNode; icon?: string }) {
  return (
    <div className="kpi">
      <div className="kpi-top">
        <span className="eyebrow">{label}</span>
        {icon && <span className="kpi-tile"><Icon name={icon} className="ic-18" /></span>}
      </div>
      <div className="kpi-value">{value}</div>
    </div>
  );
}

/** Small "Coming soon" pill for actions/integrations not yet wired to a provider. */
export function ComingSoon({ label = "Coming soon" }: { label?: string }) {
  return <span className="badge badge-neutral"><span className="bdot" />{label}</span>;
}
