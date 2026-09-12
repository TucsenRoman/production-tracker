import ProductionTracker from "./floor/ProductionTracker";
import TabletFrame from "./components/TabletFrame";

export default function Home() {
  return (
    <TabletFrame>
      <ProductionTracker />
    </TabletFrame>
  );
}
