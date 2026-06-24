export default function TorusAmbientRings() {
  return (
    <div className="rings-container" aria-hidden="true">
      <svg className="ambient-rings ring-top" viewBox="0 0 3000 2400">
        <ellipse className="ring-faint" cx="1500" cy="1020" rx="1300" ry="440" />
        <ellipse className="ring" cx="1500" cy="1100" rx="1400" ry="480" />
        <ellipse className="ring" cx="1500" cy="1200" rx="1400" ry="480" />
        <ellipse className="ring" cx="1500" cy="1200" rx="520" ry="180" />
        <ellipse className="ring" cx="1500" cy="1300" rx="1400" ry="480" />
        <ellipse className="ring-faint" cx="1500" cy="1380" rx="1300" ry="440" />
        <ellipse className="ring-bead" cx="1500" cy="1100" rx="1400" ry="480" />
        <ellipse className="ring-bead ring-bead-b" cx="1500" cy="1200" rx="1400" ry="480" />
        <ellipse className="ring-bead ring-bead-c" cx="1500" cy="1200" rx="520" ry="180" />
        <ellipse className="ring-bead ring-bead-d" cx="1500" cy="1300" rx="1400" ry="480" />
      </svg>
      <svg className="ambient-rings ring-mid" viewBox="0 0 3200 2600">
        <ellipse className="ring-faint" cx="1600" cy="1100" rx="1400" ry="470" />
        <ellipse className="ring" cx="1600" cy="1200" rx="1500" ry="510" />
        <ellipse className="ring" cx="1600" cy="1300" rx="1500" ry="510" />
        <ellipse className="ring" cx="1600" cy="1300" rx="550" ry="190" />
        <ellipse className="ring" cx="1600" cy="1400" rx="1500" ry="510" />
        <ellipse className="ring-faint" cx="1600" cy="1500" rx="1400" ry="470" />
        <ellipse className="ring-bead" cx="1600" cy="1200" rx="1500" ry="510" />
        <ellipse className="ring-bead ring-bead-d" cx="1600" cy="1300" rx="1500" ry="510" />
        <ellipse className="ring-bead ring-bead-b" cx="1600" cy="1300" rx="550" ry="190" />
        <ellipse className="ring-bead ring-bead-c" cx="1600" cy="1400" rx="1500" ry="510" />
      </svg>
    </div>
  );
}
