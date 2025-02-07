import { useState } from 'react';
import { Form, Row, Col } from 'react-bootstrap';
import StakeCard from './StakeCard';
import Summary from './Summary';

const StakesList = ({ stakes, totalStaked, pendingRewards, onUnstake, onClaim }) => {
    const [filter, setFilter] = useState('all');

    const filteredStakes = stakes.filter(stake => {
        if (filter === 'active') return !stake.isCompleted;
        if (filter === 'completed') return stake.isCompleted;
        return true;
    });

    return (
        <section>
            <h2 className="mb-4">Mis Stakes</h2>
            
            <Summary 
                totalStaked={totalStaked} 
                pendingRewards={pendingRewards} 
            />
            
            <Form.Select 
                className="mb-4"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
            >
                <option value="all">Todos los Stakes</option>
                <option value="active">Stakes Activos</option>
                <option value="completed">Stakes Completados</option>
            </Form.Select>

            <Row className="g-4">
                {filteredStakes.map(stake => (
                    <Col key={stake.id} md={6} lg={4}>
                        <StakeCard
                            stake={stake}
                            onUnstake={onUnstake}
                            onClaim={onClaim}
                        />
                    </Col>
                ))}
            </Row>

            {stakes.length === 0 && (
                <div className="alert alert-info mt-4">
                    No tienes stakes activos. ¡Comienza a stakear tus cCOP ahora!
                </div>
            )}
        </section>
    );
};

export default StakesList; 