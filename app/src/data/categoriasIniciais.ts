// Mesmas listas da migração SQL (Decisão 28), usadas pelo modo demonstração.
export const INICIAIS = {
  pessoal: {
    saida: [['Mercado', 'shopping_cart'], ['Alimentação', 'restaurant'], ['Lazer', 'sports_esports'], ['Gasolina', 'local_gas_station'], ['Pedágio', 'toll'], ['Carro', 'directions_car'], ['Manutenção', 'build'], ['Casa', 'home'], ['Contas', 'receipt'], ['Saúde', 'medical_services'], ['Educação', 'school'], ['Compras', 'shopping_bag'], ['Supérfluos', 'redeem'], ['Viagens', 'flight'], ['Assinaturas', 'subscriptions']],
    entrada: [['Salário', 'payments'], ['Pagamento', 'account_balance_wallet'], ['Comissão', 'percent'], ['Renda extra', 'savings'], ['Transferência recebida', 'move_to_inbox'], ['Venda', 'sell']],
  },
  empresa: {
    saida: [['Impostos e taxas', 'account_balance'], ['Pró-labore', 'badge'], ['Salários e encargos', 'groups'], ['Fornecedores', 'local_shipping'], ['Aluguel', 'apartment'], ['Contas', 'receipt'], ['Contabilidade', 'calculate'], ['Combustível e deslocamento', 'local_gas_station'], ['Veículos e manutenção', 'car_repair'], ['Material de escritório', 'inventory_2'], ['Equipamentos', 'devices'], ['Software e assinaturas', 'cloud'], ['Marketing e publicidade', 'campaign'], ['Tarifas bancárias', 'credit_card'], ['Cursos e treinamentos', 'school']],
    entrada: [['Serviços prestados', 'handshake'], ['Venda de produtos', 'sell'], ['Recebimento de clientes', 'payments'], ['Rendimentos financeiros', 'trending_up'], ['Aporte dos sócios', 'savings']],
  },
} as const
