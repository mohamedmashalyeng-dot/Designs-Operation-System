import type { Metadata } from "next";
import { CreateCampaignForm } from "@/components/creative/create-campaign-form";

export const metadata: Metadata = { title: "New Campaign" };

export default function CreateCampaignPage() {
  return (
    <div className="mx-auto max-w-2xl py-8">
      <CreateCampaignForm />
    </div>
  );
}
