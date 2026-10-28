import instituteBanner from "../../../imports/institute-entrance-web.jpg";

export default function InstituteBanner({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="institute-banner-wrap">
      <div className="institute-banner">
        <div className="institute-banner-sheet home-science-paper">
          <div className="home-science-paper-head">
            <span className="home-science-paper-topic">ФГБНУ «ИПИИ»</span>
          </div>
          <div className="institute-banner-copy">
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
        </div>
        <div className="institute-banner-art">
          <img src={instituteBanner} alt="Иллюстрация входа в Институт проблем искусственного интеллекта" />
        </div>
      </div>
    </div>
  );
}
