import SideBar from "../../components/SideBar/SideBar";
import CameraPanel from "../../components/CameraPanel/CameraPanel";
import "./Spy.css";

const Spy = () => {
  return (
    <div className="spy-page">
      <div className="title-spy">
        <p>Видеонаблюдение</p>
      </div>
      <CameraPanel />
      <SideBar />
    </div>
  );
};

export default Spy;
