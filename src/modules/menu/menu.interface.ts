export interface IFoodItem {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  fullDescription?: string;
  price: number;
  compareAtPrice?: number;
  image: string;
  isVeg: boolean;
  isSignature?: boolean;
  spiceLevel: 1 | 2 | 3;
  preparationTime: string;
  ingredients: string[];
  chefNote?: string;
  available: boolean;
  displayOrder?: number;
  createdAt: string;
  updatedAt: string;
}
