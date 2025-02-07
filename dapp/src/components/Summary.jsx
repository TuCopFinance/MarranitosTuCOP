import { Row, Col, Card } from 'react-bootstrap';

const Summary = ({ totalStaked, pendingRewards }) => {
    return (
        <Row className="mb-4">
            <Col md={6}>
                <Card className="shadow-sm">
                    <Card.Body>
                        <h3 className="h5">Total Stakeado</h3>
                        <p className="h3 mb-0">{totalStaked} cCOP</p>
                    </Card.Body>
                </Card>
            </Col>
            <Col md={6}>
                <Card className="shadow-sm">
                    <Card.Body>
                        <h3 className="h5">Recompensas Pendientes</h3>
                        <p className="h3 mb-0">{pendingRewards} cCOP</p>
                    </Card.Body>
                </Card>
            </Col>
        </Row>
    );
};

export default Summary; 