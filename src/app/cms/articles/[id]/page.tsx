import ArticleWorkbench from "@/app/components/cms/ArticleWorkbench";

interface EditArticlePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditArticlePage({
  params,
}: EditArticlePageProps) {
  const { id } = await params;
  return <ArticleWorkbench mode="edit" articleId={Number(id)} />;
}
