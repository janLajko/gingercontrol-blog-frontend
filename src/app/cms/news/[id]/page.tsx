import ArticleWorkbench from "@/app/components/cms/ArticleWorkbench";

interface EditNewsPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditNewsPage({ params }: EditNewsPageProps) {
  const { id } = await params;
  return <ArticleWorkbench mode="edit" articleId={Number(id)} articleType="news" />;
}
