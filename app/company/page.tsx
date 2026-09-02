import { redirect } from "next/navigation";

// This app currently serves a single company. Once there's more than one,
// this is where a company picker (or a lookup from the signed-in user)
// would decide which slug to send people to.
export default function CompanyIndexPage() {
  redirect("/company/milaca-meats");
}
