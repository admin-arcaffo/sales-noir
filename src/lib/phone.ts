/**
 * Utilitários para normalização e busca flexível de números de telefone,
 * com foco em números brasileiros (DDI +55).
 */

/**
 * Retorna as variações possíveis de um número de telefone brasileiro
 * para lidar com a presença ou ausência do nono dígito.
 * 
 * Exemplo: 
 * Entrada: "5511999999999" (com 9)
 * Saída: ["5511999999999", "551199999999"]
 * 
 * Entrada: "551199999999" (sem 9)
 * Saída: ["551199999999", "5511999999999"]
 * 
 * Entrada: "11999999999" (sem 55, mas brasileiro na essência - tratamos apenas se vier limpo)
 * Para segurança, a API espera a string já apenas com dígitos numéricos.
 * 
 * @param phone String contendo apenas os dígitos do telefone.
 * @returns Array de strings com as variações.
 */
export function getBrazilianPhoneVariations(phone: string): string[] {
  // Limpa tudo que não for dígito
  const cleanPhone = phone.replace(/\D/g, '');

  if (!cleanPhone) return [];

  const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

  // Se o número não começa com 55, mas parece BR local (DDD + número), geramos também com DDI.
  if (!cleanPhone.startsWith('55')) {
    if (cleanPhone.length === 10 || cleanPhone.length === 11) {
      return unique([cleanPhone, ...getBrazilianPhoneVariations(`55${cleanPhone}`)]);
    }
    return [cleanPhone];
  }

  const ddi = cleanPhone.substring(0, 2); // '55'
  const ddd = cleanPhone.substring(2, 4); // '11'
  const number = cleanPhone.substring(4); // '999999999' ou '99999999'

  // Só faz sentido tentar a variação do 9º dígito se o DDD tiver 2 dígitos e o número 8 ou 9 dígitos.
  if (ddd.length !== 2 || (number.length !== 8 && number.length !== 9)) {
    return [cleanPhone]; // Número estranho (ex: curto demais, ou longo demais)
  }

  // Verifica se o DDD é válido no Brasil (começa com 1-9 e termina com 1-9, simplificadamente)
  // Alguns DDDs não usam nono dígito de celular no interior para fixo, mas
  // no WhatsApp, o nono dígito é um problema universal no Brasil.
  const isDDDValid = /^[1-9][1-9]$/.test(ddd);

  if (!isDDDValid) {
    return [cleanPhone];
  }

  if (number.length === 9) {
    // Caso 1: Veio com 9 dígitos (ex: 988887777). 
    // Pode ser que no BD esteja salvo SEM o nono dígito, especialmente no início do nono dígito.
    // O nono dígito no Brasil é sempre o 9.
    if (number.startsWith('9')) {
      const numberWithout9 = number.substring(1);
       return unique([cleanPhone, `${ddi}${ddd}${numberWithout9}`, `${ddd}${number}`, `${ddd}${numberWithout9}`]);
    } else {
      return [cleanPhone]; // celular começando com algo diferente de 9? Estranho, mas mantemos o original.
    }
  } else if (number.length === 8) {
    // Caso 2: Veio com 8 dígitos (ex: 88887777).
    // Pode ser que no BD esteja salvo COM o nono dígito (9 na frente).
    // Muitas vezes no WhatsApp antigos o número trafega sem o nono dígito,
    // mas o cliente salvou com o nono dígito.
    // Para mitigar o problema do webhook vs banco local:
    
    // Verificamos se o primeiro dígito atual é tipicamente um prefixo de celular (ex: 6 a 9).
    // Fixo geralmente começa com 2 a 5.
    // No entanto, para fins de busca, é mais seguro simplesmente tentar adicionar o '9' na frente.
    const numberWith9 = `9${number}`;
    return unique([cleanPhone, `${ddi}${ddd}${numberWith9}`, `${ddd}${number}`, `${ddd}${numberWith9}`]);
  }

  return [cleanPhone];
}

export function getOutboundWhatsAppNumberCandidates(phone: string): string[] {
  const cleanPhone = phone.replace(/\D/g, '');
  if (!cleanPhone) return [];

  const variations = getBrazilianPhoneVariations(cleanPhone);
  const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

  if (!cleanPhone.startsWith('55') && (cleanPhone.length === 10 || cleanPhone.length === 11)) {
    return unique([
      ...variations.filter((value) => value.startsWith('55')),
      cleanPhone,
      ...variations.filter((value) => !value.startsWith('55')),
    ]);
  }

  if (cleanPhone.startsWith('55')) {
    return unique([
      cleanPhone,
      ...variations.filter((value) => value.startsWith('55')),
      ...variations.filter((value) => !value.startsWith('55')),
    ]);
  }

  return [cleanPhone];
}

export function getOutboundWhatsAppNumber(phone: string): string {
  return getOutboundWhatsAppNumberCandidates(phone)[0] || phone.replace(/\D/g, '');
}
