import BillingProductDetail from "@/app/components/cms/BillingProductDetail";

interface BillingProductDetailPageProps {
  params: Promise<{ product_code: string }>;
}

export default async function BillingProductDetailPage({
  params,
}: BillingProductDetailPageProps) {
  const { product_code } = await params;

  return <BillingProductDetail product_code={product_code} />;
}
