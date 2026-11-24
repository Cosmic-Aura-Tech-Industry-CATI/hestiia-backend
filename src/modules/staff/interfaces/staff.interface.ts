export interface IStaffMember {
  _id: string;
  name: string;
  phone: string;
  email: string;
  role: 'staff';
  isActive: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface ICreateStaffDTO {
  name: string;
  phone: string;
  email: string;
  role?: string;
}

export interface IUpdateStaffDTO {
  name?: string;
  phone?: string;
  email?: string;
  role?: string;
  isActive?: boolean;
}

export interface IStaffQuery {
  page?: string | number;
  limit?: string | number;
  search?: string;
  status?: 'active' | 'inactive' | 'all';
  sortBy?: string;
  order?: 'asc' | 'desc';
}

export interface IStaffPaginationMetadata {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface IStaffListResponse {
  staff: IStaffMember[];
  pagination: IStaffPaginationMetadata;
}
