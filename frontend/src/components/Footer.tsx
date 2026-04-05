import { Shield, ExternalLink } from "lucide-react";
import { CONTRACTS } from "../lib/constants";

export default function Footer() {
  return (
    <footer className="border-t mt-auto" style={{ borderColor: "var(--border-subtle)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
          <Shield className="w-4 h-4" style={{ color: "var(--accent)" }} />
          <span>
            Aegis Scanner by{" "}
            <a href="https://x.com/uniq_minds" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: "var(--accent)" }}>
              Uniq Minds
            </a>
          </span>
          <span style={{ color: "var(--border-subtle)" }}>·</span>
          <span>The Safety Oracle for BNB Chain</span>
        </div>
        <div className="flex items-center gap-4 text-[11px]" style={{ color: "var(--text-muted)" }}>
          <a href={`https://testnet.bscscan.com/address/${CONTRACTS.SCANNER}`} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
            Scanner Contract <ExternalLink className="w-2.5 h-2.5" />
          </a>
          <a href="https://github.com/Tonyflam/aegis-protocol" target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
            GitHub <ExternalLink className="w-2.5 h-2.5" />
          </a>
          <a href={`https://bscscan.com/token/${CONTRACTS.UNIQ_TOKEN}`} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1" style={{ color: "var(--bnb)" }}>
            $UNIQ <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
      </div>
    </footer>
  );
}
