export interface SelectProvider {
  key: number;
  label: string;
  group: string;
}
export interface SelectProvidersResponse {
  catalogs: Record<string, SelectProvider[]>;
}