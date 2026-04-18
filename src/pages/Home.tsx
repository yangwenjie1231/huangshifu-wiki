import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { AcademyHome } from './home/AcademyHome';
import { DefaultHome } from './home/DefaultHome';

const Home = () => {
  const { isAcademy } = useTheme();

  if (isAcademy) {
    return <AcademyHome />;
  }

  return <DefaultHome />;
};

export default Home;
