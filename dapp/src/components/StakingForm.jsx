import { useState } from 'react';
import { Card, Form, Button } from 'react-bootstrap';

const StakingForm = ({ onStake, onApprove }) => {
    const [amount, setAmount] = useState('');
    const [duration, setDuration] = useState('30');

    return (
        <Card className="shadow-sm mb-4">
            <Card.Body>
                <Card.Title>Nuevo Staking</Card.Title>
                <Form>
                    <Form.Group className="mb-3">
                        <Form.Label>Cantidad:</Form.Label>
                        <Form.Control
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            min="0"
                            step="0.01"
                        />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Duración (días):</Form.Label>
                        <Form.Select
                            value={duration}
                            onChange={(e) => setDuration(e.target.value)}
                        >
                            <option value="30">30 días</option>
                            <option value="60">60 días</option>
                            <option value="90">90 días</option>
                        </Form.Select>
                    </Form.Group>
                    <div className="d-grid gap-2">
                        <Button variant="warning" onClick={() => onApprove(amount)}>
                            Aprobar Tokens
                        </Button>
                        <Button variant="success" onClick={() => onStake(amount, duration)}>
                            Hacer Stake
                        </Button>
                    </div>
                </Form>
            </Card.Body>
        </Card>
    );
};

export default StakingForm; 