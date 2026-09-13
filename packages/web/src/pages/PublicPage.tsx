import { Link } from "react-router-dom";
import { PublicCatalogue } from "../components/PublicCatalogue.tsx";

export function PublicPage() {
  return <main className="public-page"><Link to="/">← isocan home</Link><PublicCatalogue page /></main>;
}
