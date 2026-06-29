exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Método Não Permitido' };
    }

    try {
        const { name, lastname, email, cpf } = JSON.parse(event.body);
        const accessToken = process.env.MP_ACCESS_TOKEN;

        if (!accessToken) {
            return { 
                statusCode: 500, 
                body: JSON.stringify({ error: 'Falta configurar a variável MP_ACCESS_TOKEN no painel do Netlify.' }) 
            };
        }

        const bodyPayload = {
            transaction_amount: 1.00,
            description: "Acesso 24h ao Ted",
            payment_method_id: "pix",
            payer: {
                email: email.trim(),
                first_name: name.trim(),
                last_name: lastname.trim(),
                identification: {
                    type: "CPF",
                    number: cpf.replace(/\D/g, '')
                }
            }
        };

        const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'X-Idempotency-Key': `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
            },
            body: JSON.stringify(bodyPayload)
        });

        const dataData = await mpResponse.json();

        if (!mpResponse.ok) {
            console.error('Erro retornado pelo Mercado Pago:', dataData);
            return { 
                statusCode: 400, 
                body: JSON.stringify({ error: 'O Mercado Pago recusou os dados. Verifique o e-mail ou CPF digitados.' }) 
            };
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                payment_id: dataData.id,
                qr_code: dataData.point_of_interaction.transaction_data.qr_code,
                qr_code_base64: dataData.point_of_interaction.transaction_data.qr_code_base64
            })
        };

    } catch (error) {
        console.error('Erro na função gerar-pix:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Erro de processamento interno no servidor.' })
        };
    }
};
