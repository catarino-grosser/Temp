exports.handler = async (event, context) => {
    const paymentId = event.queryStringParameters.id;
    const accessToken = process.env.MP_ACCESS_TOKEN;

    if (!paymentId) {
        return { statusCode: 400, body: JSON.stringify({ error: 'ID do pagamento não fornecido.' }) };
    }

    try {
        const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!mpResponse.ok) {
            return { statusCode: 404, body: JSON.stringify({ error: 'Pagamento não localizado na API.' }) };
        }

        const dataData = await mpResponse.json();

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: dataData.status })
        };

    } catch (error) {
        console.error('Erro ao checar status do pagamento:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Erro ao verificar transação.' }) };
    }
};
