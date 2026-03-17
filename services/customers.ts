import { getCustomerSalesContext } from '@/services/gateway';
import { checkLinkOptionExists, searchLinkOptions } from '@/services/master-data';

export function searchCustomers(query: string) {
  return searchLinkOptions('Customer', query);
}

export function customerExists(customer: string) {
  return checkLinkOptionExists('Customer', customer);
}

export function fetchCustomerSalesContext(customer: string) {
  return getCustomerSalesContext(customer);
}
