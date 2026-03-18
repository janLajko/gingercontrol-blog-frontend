// Blog generation interfaces based on FastAPI backend schema

export interface BlogCustomization {
  tone?: 'professional' | 'casual' | 'technical' | 'friendly' | 'authoritative';
  target_audience?: 'beginners' | 'intermediate' | 'advanced' | 'general';
  content_type?: 'tutorial' | 'guide' | 'review' | 'comparison' | 'news' | 'opinion';
  word_count_target?: number;
  include_faq?: boolean;
  include_conclusion?: boolean;
  include_table_of_contents?: boolean;
  focus_keywords?: string[];
  exclude_domains?: string[];
}

export interface BlogGenerationRequest {
  keyword: string;
  max_attempts?: number;
  seo_threshold?: number;
  customization?: BlogCustomization;
  priority?: 'low' | 'normal' | 'high';
  callback_url?: string;
  user_id?: string;
  authorName?: string;
  authorAvatar?: string;
  category?: string;
  coverImage?: string;
}

export interface GeneratedArticle {
  slug: string;
  title: string;
  description: string;
  tags: string[];
  body: string;
}

export interface ArticleAuthorDetails {
  authorName?: string;
  authorAvatar?: string;
  category?: string;
  coverImage?: string;
}

export interface CmsArticle {
  id: number;
  run_id?: string | null;
  keyword?: string | null;
  slug: string;
  title: string;
  description: string;
  tags: string[];
  body: string;
  authorName?: string;
  authorAvatar?: string;
  category?: string;
  coverImage?: string;
  user_id?: string | null;
  status?: string;
  success?: boolean;
  sources_used: string[];
  source_details: Array<Record<string, unknown>>;
  seo_scores: Record<string, unknown>;
  final_score?: number | null;
  model_used?: string | null;
  customization: Record<string, unknown>;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CmsArticlePayload {
  run_id?: string;
  keyword?: string;
  slug: string;
  title: string;
  description: string;
  tags: string[];
  body: string;
  authorName?: string;
  authorAvatar?: string;
  category?: string;
  coverImage?: string;
  user_id?: string;
  status?: string;
  success?: boolean;
  sources_used?: string[];
  source_details?: Array<Record<string, unknown>>;
  seo_scores?: Record<string, unknown>;
  final_score?: number;
  model_used?: string;
  customization?: Record<string, unknown>;
  error_message?: string | null;
}

export interface CmsCategory {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface CmsCategoryPayload {
  name: string;
}

export interface CmsImageUploadResponse {
  success: boolean;
  filename: string;
  content_type: string;
  size_bytes: number;
  gcs_uri: string;
  url: string;
}

export interface SEOScores {
  title_score: number;
  meta_description_score: number;
  keyword_optimization_score: number;
  content_structure_score: number;
  readability_score: number;
  content_quality_score: number;
  technical_seo_score: number;
  final_score: number;
  word_count: number;
  reading_time_minutes: number;
  keyword_density: number;
}

export interface ContentMetadata {
  sources_used: string[];
  processing_time_seconds: number;
  model_used: string;
  content_language: string;
  generated_at: string;
}

export interface BlogGenerationResponse {
  run_id: string;
  final_blog: string;
  article: GeneratedArticle;
  seo_scores: SEOScores;
  attempts: number;
  success: boolean;
  metadata: ContentMetadata;
  customization_applied: BlogCustomization;
  author: ArticleAuthorDetails;
  post_id?: number;
  status: string;
  progress_percentage: number;
  estimated_reading_time: number;
  content_quality_grade: string;
}

export interface LoadingQuote {
  text: string;
  icon: string;
}

export const LOADING_QUOTES: LoadingQuote[] = [
  { text: "Crafting your perfect blog post...", icon: "PenTool" },
  { text: "Analyzing keywords for maximum impact...", icon: "Search" },
  { text: "Optimizing content for SEO success...", icon: "TrendingUp" },
  { text: "Generating engaging headlines...", icon: "Type" },
  { text: "Structuring content for readability...", icon: "AlignLeft" },
  { text: "Adding finishing touches...", icon: "Sparkles" },
  { text: "Quality checking your content...", icon: "CheckCircle" },
  { text: "Almost there, polishing the final draft...", icon: "Edit3" }
];
