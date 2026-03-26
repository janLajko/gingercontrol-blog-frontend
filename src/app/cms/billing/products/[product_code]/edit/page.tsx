import BillingProductEditForm from "@/app/components/cms/BillingProductEditForm";

interface BillingProductEditPageProps {
  params: Promise<{ product_code: string }>;
}

export default async function BillingProductEditPage({
  params,
}: BillingProductEditPageProps) {
  const { product_code } = await params;

  return <BillingProductEditForm product_code={product_code} />;
}
