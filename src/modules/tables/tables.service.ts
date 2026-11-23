import { db } from '../../shared/config/store.js';

export interface ITable {
  id: string;
  tableNumber: string;
  zone: string;
  capacity: number;
  status: 'available' | 'reserved' | 'occupied' | 'cleaning';
}

const DEFAULT_TABLES: ITable[] = [
  { id: 'tbl_1', tableNumber: 'Table 1', zone: 'AC Main Hall', capacity: 4, status: 'available' },
  { id: 'tbl_2', tableNumber: 'Table 2', zone: 'AC Main Hall', capacity: 4, status: 'available' },
  { id: 'tbl_3', tableNumber: 'Booth B1', zone: 'Leather Booths', capacity: 6, status: 'available' },
  { id: 'tbl_4', tableNumber: 'Booth B2', zone: 'Leather Booths', capacity: 6, status: 'reserved' },
  { id: 'tbl_5', tableNumber: 'Table 5', zone: 'Family Lounge', capacity: 8, status: 'available' },
];

export const tablesService = {
  async getTables() {
    return DEFAULT_TABLES;
  },
  async updateStatus(id: string, status: 'available' | 'reserved' | 'occupied' | 'cleaning') {
    const table = DEFAULT_TABLES.find((t) => t.id === id);
    if (table) table.status = status;
    return table;
  },
};

export default tablesService;
