import { Link } from "react-router-dom";
import { PageFrame } from "../components/Layout.jsx";
import { PageHeader } from "../components/Ui.jsx";

export default function About() {
  return (
    <PageFrame>
      <div className="container section narrow-section">
        <PageHeader title="About UniMak Study Hub" subtitle="A student resource platform." />
        <p>
          UniMak Study Hub helps students find and organise learning materials. It is an
          independent platform and is not an official University of Makeni website.
        </p>
        <p className="muted">
          Department names are included for browsing and profile selection. For current
          programme and department information, confirm details with the university.
        </p>
        <Link className="text-link" to="/departments">Browse departments</Link>
      </div>
    </PageFrame>
  );
}
