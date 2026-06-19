export default function Spinner({ center = true }) {
  const el = <div className="spinner" />
  return center ? <div className="spinner-center">{el}</div> : el
}
