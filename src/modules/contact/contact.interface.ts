export interface IPhoneContact {
  number: string;
  enabled: boolean;
}

export interface IEmailContact {
  address: string;
  enabled: boolean;
}

export interface IWhatsAppContact {
  number: string;
  enabled: boolean;
}

export interface IContactSettings {
  _id?: any;
  id?: string;
  phone: IPhoneContact;
  email: IEmailContact;
  whatsapp: IWhatsAppContact;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface IUpdateContactDTO {
  phone?: {
    number?: string;
    enabled?: boolean;
  };
  email?: {
    address?: string;
    enabled?: boolean;
  };
  whatsapp?: {
    number?: string;
    enabled?: boolean;
  };
}

export interface ICustomerContactItem {
  number?: string;
  address?: string;
  action: string;
}

export interface ICustomerContactResponse {
  phone: ICustomerContactItem | null;
  email: ICustomerContactItem | null;
  whatsapp: ICustomerContactItem | null;
}
